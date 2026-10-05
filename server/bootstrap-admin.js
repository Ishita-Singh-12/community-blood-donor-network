// Explicit persistent-database bootstrap; never seed known demo credentials in production.
import mongoose from 'mongoose';
import {User} from './models.js';
import {hashPassword,id} from './auth.js';
const {MONGODB_URI,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
if(!MONGODB_URI||!ADMIN_EMAIL||!ADMIN_PASSWORD||ADMIN_PASSWORD.length<8)throw Error('Set MONGODB_URI, ADMIN_EMAIL and an 8+ character ADMIN_PASSWORD securely');
await mongoose.connect(MONGODB_URI);
try{if(await User.exists({email:ADMIN_EMAIL.toLowerCase()}))throw Error('Account already exists; refusing to overwrite');await User.create({id:id('U'),email:ADMIN_EMAIL.toLowerCase(),name:'Institution administrator',passwordHash:await hashPassword(ADMIN_PASSWORD),role:'admin',consentAt:new Date()});console.log('Administrator created. No credentials printed.');}finally{await mongoose.disconnect();}
