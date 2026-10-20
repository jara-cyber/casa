type Account={id:string;email?:string;user_metadata?:Record<string,unknown>};
type Ports={
 actor:(token:string)=>Promise<Account|null>;
 owner:(id:string)=>Promise<boolean>;
 account:(id:string)=>Promise<Account|null>;
 update:(id:string,password:string,metadata:Record<string,unknown>)=>Promise<void>;
};
const origin='https://jara-cyber.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function passwordHandler(ports:Ports){
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'Método no permitido'},405);
  try{
   const bearer=req.headers.get('Authorization')||'';
   if(!bearer.startsWith('Bearer '))return reply({error:'Inicia sesión'},401);
   const actor=await ports.actor(bearer.slice(7));
   if(!actor)return reply({error:'Tu sesión ha caducado. Vuelve a entrar.'},401);
   if(!await ports.owner(actor.id))return reply({error:'Solo el propietario de la web puede cambiar contraseñas de otras cuentas.'},403);
   if(Number(req.headers.get('Content-Length')||0)>4096)return reply({error:'Solicitud demasiado grande'},413);
   const input=await req.json();
   if(input.action!=='password'||typeof input.userId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.userId)
    ||typeof input.confirmEmail!=='string'||typeof input.password!=='string'
    ||input.password.length<12||input.password.length>128)return reply({error:'Revisa el usuario y la contraseña (entre 12 y 128 caracteres).'},400);
   const target=await ports.account(input.userId);
   if(!target)return reply({error:'La cuenta ya no existe.'},404);
   if(!target.email||input.confirmEmail!==target.email)return reply({error:'El correo de confirmación no coincide.'},400);
   if(target.id!==actor.id&&await ports.owner(target.id))return reply({error:'Cada propietario debe cambiar su propia contraseña.'},403);
   // Confirmar de nuevo el permiso inmediatamente antes de la operación privilegiada.
   if(!await ports.owner(actor.id))return reply({error:'Ya no tienes permiso de propietario.'},403);
   await ports.update(target.id,input.password,{...target.user_metadata,must_change_password:target.id!==actor.id});
   return reply({ok:true,self:target.id===actor.id});
  }catch(e){
   const error=e as {code?:string;status?:number};
   if(error.code==='same_password')return reply({error:'Elige una contraseña diferente a la anterior.'},400);
   if(error.code==='weak_password')return reply({error:'La contraseña no cumple los requisitos de Supabase. Elige otra más segura.'},400);
   return reply({error:'No se pudo cambiar la contraseña. Comprueba la función casa-admin y vuelve a intentarlo.'},500);
  }
 };
}
// Los tests importan el manejador sin inicializar servicios ni recibir credenciales reales.
if(typeof Deno!=='undefined'){
 const {createClient}=await import('npm:@supabase/supabase-js@2');
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 Deno.serve(passwordHandler({
  async actor(token){const {data,error}=await db.auth.getUser(token);return error?null:data.user},
  async owner(id){const {data,error}=await db.from('site_admins').select('user_id').eq('user_id',id).maybeSingle();if(error)throw error;return !!data},
  async account(id){const {data,error}=await db.auth.admin.getUserById(id);if(error)return null;return data.user},
  async update(id,password,user_metadata){const {error}=await db.auth.admin.updateUserById(id,{password,user_metadata});if(error)throw error}
 }));
}
