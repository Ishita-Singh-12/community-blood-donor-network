import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Server} from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {BLOOD_GROUPS,matchDonors} from './matching.js';
import {hospitals,donors,inventory,seededRequests} from './seed.js';
import {User,Session,Hospital,Donor,Request,Inventory,Audit,Appointment,Alert} from './models.js';
import {hashPassword,verifyPassword,sessionUser,publicUser,setSession,hashToken,id,requireRole} from './auth.js';
if(process.env.NODE_ENV==='production'&&!process.env.MONGODB_URI)throw Error('MONGODB_URI required');
const memory=!process.env.MONGODB_URI?await MongoMemoryServer.create({binary:{version:'7.0.14'}}):null;
await mongoose.connect(process.env.MONGODB_URI||memory.getUri('blood_donor_network_v2'));
await Promise.all([User,Session,Hospital,Donor,Request,Inventory,Appointment,Alert].map(m=>m.init()));
// Fictional demo accounts are seeded only in explicitly local temporary mode.
if(memory&&await User.countDocuments()===0){
 await Hospital.insertMany(hospitals.map(h=>({...h,approved:true})));
 await Donor.insertMany(donors);await Request.insertMany(seededRequests().map(r=>({...r,collectedUnits:r.status==='Fulfilled'?r.units:0})));
 await Inventory.insertMany(hospitals.flatMap(h=>inventory.map(i=>({...i,hospitalId:h.id}))));
 const passwordHash=hashPassword('LifeLink-demo-2026!');
 await User.insertMany([{id:'admin-demo',email:'admin@lifelink.test',name:'Demo Administrator',role:'admin',passwordHash},...hospitals.map(h=>({id:'user-'+h.id,email:h.id+'@lifelink.test',name:h.name,role:'hospital',hospitalId:h.id,passwordHash})),...donors.map(d=>({id:'user-'+d.id,email:d.id+'@lifelink.test',name:d.name,role:'donor',donorId:d.id,passwordHash}))]);
}
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN||false,credentials:true}});
if(process.env.CLIENT_ORIGIN)app.use(cors({origin:process.env.CLIENT_ORIGIN,credentials:true}));
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'30kb'}));app.use(cookieParser());app.use('/api',rateLimit({windowMs:60000,limit:180}));
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
app.use('/api',route(async(req,res,next)=>{const origin=req.headers.origin;if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin&&origin!==process.env.CLIENT_ORIGIN&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'Untrusted request origin'});req.user=await sessionUser(req.cookies.lifelink_session);next();}));
const audit=(req,action,targetId,details={})=>Audit.create({actorId:req.user?.id,action,targetId,details});
async function hospitalGuard(req,res,next){const h=await Hospital.findOne({id:req.user.hospitalId,approved:true});if(!h)return res.status(403).json({error:'Institution approval required'});req.hospital=h;next();}
const clean=list=>list.map(({_id,...r})=>r);
async function state(user){
 const hospitalList=await Hospital.find(user.role==='admin'?{}:{approved:true}).lean();
 let donorList=[],requests=[];
 if(user.role==='donor'){
  const donor=await Donor.findOne({id:user.donorId}).lean();donorList=donor?[donor]:[];
  const all=await Request.find({status:{$in:['Open','Scheduled']}}).sort({createdAt:-1}).lean();
  requests=all.filter(r=>r.acceptedDonors.includes(user.donorId)||(donor&&matchDonors([donor],r).length));
 }else{requests=await Request.find(user.role==='hospital'?{hospitalId:user.hospitalId}:{}).sort({createdAt:-1}).lean();donorList=await Donor.find().lean();}
 const stock=await Inventory.find(user.role==='hospital'?{hospitalId:user.hospitalId}:{}).lean();
 // Coordinators receive approximate area/group and IDs, never donor email/exact coordinates.
 if(user.role!=='donor')donorList=donorList.map(d=>({id:d.id,name:d.name,bloodGroup:d.bloodGroup,area:d.area,available:d.available}));
 return {donors:clean(donorList),hospitals:clean(hospitalList),requests:clean(requests),inventory:clean(stock),demo:!!memory,user:publicUser(user),appointments:clean(await Appointment.find(user.role==='donor'?{donorId:user.donorId}:user.role==='hospital'?{hospitalId:user.hospitalId}:{}).lean())};
}
async function broadcast(){for(const socket of io.sockets.sockets.values()){const user=await sessionUser(socket.data.token);if(!user){socket.disconnect(true);continue;}socket.emit('state:update',await state(user));}}
app.get('/api/health',(_,res)=>res.json({ok:true,database:mongoose.connection.readyState===1?'connected':'disconnected',demo:!!memory}));
app.get('/api/auth/me',(req,res)=>res.json({user:req.user?publicUser(req.user):null,demo:!!memory}));
const loginLimit=rateLimit({windowMs:15*60000,limit:20});
app.post('/api/auth/login',loginLimit,route(async(req,res)=>{const body=z.object({email:z.string().email().max(200),password:z.string().min(1).max(128)}).strict().parse(req.body);const user=await User.findOne({email:body.email.toLowerCase()});if(!user||!await verifyPassword(body.password,user.passwordHash))return res.status(401).json({error:'Invalid email or password'});await setSession(res,user);res.json({user:publicUser(user)});}));
app.post('/api/auth/logout',route(async(req,res)=>{if(req.cookies.lifelink_session)await Session.deleteOne({hash:hashToken(req.cookies.lifelink_session)});res.clearCookie('lifelink_session',{path:'/'});res.json({ok:true});}));
const location=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).strict();
app.post('/api/auth/register',loginLimit,route(async(req,res)=>{
 const b=z.object({email:z.string().email().max(200),password:z.string().min(12).max(128),name:z.string().min(2).max(100),role:z.enum(['donor','hospital']),consent:z.literal(true),bloodGroup:z.enum(BLOOD_GROUPS).optional(),area:z.string().min(2).max(120),location}).strict().parse(req.body);
 if(await User.exists({email:b.email.toLowerCase()}))return res.status(409).json({error:'Account already exists'});
 if(b.role==='donor'&&!b.bloodGroup)return res.status(400).json({error:'Blood group required'});
 const profileId=id(b.role==='donor'?'D':'H');const user=await User.create({id:id('U'),email:b.email.toLowerCase(),passwordHash:hashPassword(b.password),name:b.name,role:b.role,consentAt:new Date(),...(b.role==='donor'?{donorId:profileId}:{hospitalId:profileId})});
 if(b.role==='donor')await Donor.create({id:profileId,userId:user.id,name:b.name,bloodGroup:b.bloodGroup,area:b.area,location:b.location,available:false});
 else{await Hospital.create({id:profileId,name:b.name,area:b.area,location:b.location,approved:false});await Inventory.insertMany(BLOOD_GROUPS.map(bloodGroup=>({hospitalId:profileId,bloodGroup,units:0})));}
 await setSession(res,user);res.status(201).json({user:publicUser(user)});
}));
app.get('/api/admin/hospitals',requireRole('admin'),route(async(_,res)=>res.json({hospitals:await Hospital.find().lean()})));
app.patch('/api/admin/hospitals/:id',requireRole('admin'),route(async(req,res)=>{const{approved}=z.object({approved:z.boolean()}).strict().parse(req.body);const h=await Hospital.findOneAndUpdate({id:req.params.id},{approved},{new:true});if(!h)return res.status(404).json({error:'Institution not found'});await audit(req,'hospital.approval',h.id,{approved});await broadcast();res.json(h);}));
app.get('/api/state',requireRole('donor','hospital','admin'),route(async(req,res)=>res.json(await state(req.user))));
app.patch('/api/donors/:id',requireRole('donor'),route(async(req,res)=>{if(req.params.id!==req.user.donorId)return res.status(403).json({error:'Not your donor profile'});const{available}=z.object({available:z.boolean()}).strict().parse(req.body);const d=await Donor.findOneAndUpdate({id:req.params.id},{available},{new:true});await broadcast();res.json(d);}));
io.use(async(socket,next)=>{try{const cookie=socket.handshake.headers.cookie||'';const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('lifelink_session='))?.slice(17);const user=await sessionUser(token);if(!user)return next(Error('Sign in required'));socket.data.user=user;socket.data.token=token;next();}catch{next(Error('Sign in required'));}});
io.on('connection',socket=>{const u=socket.data.user;if(u.donorId)socket.join('donor:'+u.donorId);socket.join('user:'+u.id);socket.on('donor:join',(_,ack)=>ack?.({ok:true}));});
// Feature routes follow below.
