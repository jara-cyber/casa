import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='https://jara-cyber.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const allowed=(endpoint:string)=>{try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)$/.test(u.hostname)}catch{return false}};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return response({error:'Método no permitido'},405);
 try{
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!token)return response({error:'Inicia sesión'},401);
 const input=await req.json();
 if(input.action==='setup'){
  const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return response({error:'Inicia sesión'},401);
  const {data:owner}=await db.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(!owner)return response({error:'Solo el propietario puede activar el servidor'},403);
  const keys=webpush.generateVAPIDKeys();
  const {error:save}=await db.from('push_config').upsert({id:true,public_key:keys.publicKey,private_key:keys.privateKey,dispatch_token:crypto.randomUUID()+crypto.randomUUID(),contact:'mailto:'+user.email,function_url:url+'/functions/v1/casa-push'},{onConflict:'id',ignoreDuplicates:true});
  if(save)throw save;
  return response({ok:true});
 }
 const {data:config,error:ce}=await db.from('push_config').select('*').eq('id',true).maybeSingle();
 if(ce)throw ce;
 if(!config)return response({error:'El propietario debe activar el servidor'},503);
 let rows:any[];
 if(input.action==='dispatch'){
  if(token!==config.dispatch_token)return response({error:'No autorizado'},403);
  const {data,error}=await db.rpc('claim_push');if(error)throw error;
  rows=(data||[]).map((row:any)=>({...row,queue:'push_deliveries'}));
  const activity=await db.rpc('claim_activity_push');
  // Compatibilidad durante la actualización: los recordatorios siguen funcionando
  // si la migración de actividad todavía no está instalada.
  if(activity.error&&activity.error.code!=='PGRST202')throw activity.error;
  rows.push(...(activity.data||[]).map((row:any)=>({...row,queue:'push_activity_deliveries'})));
  await db.from('push_config').update({last_dispatch:new Date().toISOString()}).eq('id',true);
 }else if(input.action==='test'){
  const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return response({error:'Inicia sesión'},401);
  const {data,error:se}=await db.from('push_subscriptions').update({last_test:new Date().toISOString()}).eq('user_id',user.id).eq('endpoint',input.endpoint).lt('last_test',new Date(Date.now()-60000).toISOString()).select('endpoint,p256dh,auth');
  if(se)throw se;rows=data||[];
  if(!rows.length)return response({error:'Activa los avisos y espera un minuto entre pruebas'},400);
 }else return response({error:'Acción no válida'},400);
 webpush.setVapidDetails(config.contact,config.public_key,config.private_key);
 let sent=0;
 await Promise.all(rows.map(async row=>{
  if(!allowed(row.endpoint))return;
  try{
   await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title:'Casa',body:row.body||(input.action==='test'?'Los avisos están preparados en este dispositivo.':'Tienes un recordatorio de agenda. Abre Casa para ver los detalles.'),tag:row.delivery_id||'casa-test'}),{TTL:300,timeout:8000,urgency:'normal'});
   sent++;
   if(row.delivery_id){const {error}=await db.from(row.queue==='push_activity_deliveries'?'push_activity_deliveries':'push_deliveries').update({sent_at:new Date().toISOString()}).eq('id',row.delivery_id);if(error)throw error}
  }catch(e){const status=(e as {statusCode?:number}).statusCode;
   if(status===404||status===410)await db.from('push_subscriptions').delete().eq('endpoint',row.endpoint);
   // Otros errores se reintentan tras el arrendamiento; no se registran endpoints ni secretos.
  }
 }));
 return response({ok:true,sent});
 }catch{return response({error:'No se pudo completar el envío. Revisa la instalación de casa-push en Supabase.'},500)}
});
