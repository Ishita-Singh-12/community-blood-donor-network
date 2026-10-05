import {randomBytes,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {scrypt} from 'node:crypto';
import {User,Session} from './models.js';
const derive=promisify(scrypt);
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await derive(password,salt,64)).toString('hex');}
export async function verifyPassword(password,hash){const[salt,expected]=hash.split(':');const actual=await derive(password,salt,64);return timingSafeEqual(actual,Buffer.from(expected,'hex'));}
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,donorId:u.donorId,hospitalId:u.hospitalId});
export async function sessionUser(token){if(!token)return null;const s=await Session.findOne({hash:hashToken(token),expiresAt:{$gt:new Date()}});return s?User.findOne({id:s.userId}):null;}
export async function setSession(res,user){const token=randomBytes(32).toString('hex');await Session.create({hash:hashToken(token),userId:user.id,expiresAt:new Date(Date.now()+7*86400000)});res.cookie('lifelink_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.NODE_ENV==='production'?'none':'lax',partitioned:process.env.NODE_ENV==='production',maxAge:7*86400000,path:'/'});}
export const id=prefix=>prefix+'-'+randomUUID().slice(0,12);
export const requireRole=(...roles)=>(req,res,next)=>{if(!req.user)return res.status(401).json({error:'Sign in required'});if(!roles.includes(req.user.role))return res.status(403).json({error:'Not allowed for this account'});next();};
