import webpush from 'web-push';
import {User,Subscription} from './models.js';
export const pushEnabled=!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
if(pushEnabled)webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
export async function sendPush(donorId,requestId){
 if(!pushEnabled)return;
 const user=await User.findOne({donorId});if(!user)return;
 for(const s of await Subscription.find({userId:user.id})){
  try{await webpush.sendNotification({endpoint:s.endpoint,keys:s.keys},JSON.stringify({title:'LifeLink request',body:'A blood request matches your preferences. Sign in to review it.',requestId}),{TTL:3600,timeout:5000});}
  catch(e){if([404,410].includes(e.statusCode))await Subscription.deleteOne({_id:s._id});else console.warn('Push delivery failed',e.statusCode||'network');}
 }
}
