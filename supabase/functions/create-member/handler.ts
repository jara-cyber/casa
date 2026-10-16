type Dependencies={verifyToken:(token:string)=>Promise<{id:string}|null>;getProfile:(id:string)=>Promise<{role:string;family_id:string}|null>;createUser:(email:string,password:string,name:string)=>Promise<{id:string}>;insertProfile:(profile:{id:string;family_id:string;name:string;email:string;role:string})=>Promise<void>;deleteUser:(id:string)=>Promise<void>};
export function createMemberHandler(deps:Dependencies,allowedOrigin='https://jara-cyber.github.io'){
 return async function handle(req:Request){const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};if(origin===allowedOrigin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization, x-client-info, apikey, content-type';headers['Access-Control-Allow-Methods']='POST, OPTIONS'}const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!==allowedOrigin)return reply({error:'Origen no permitido.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
 const match=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i);if(!match)return reply({error:'Inicia sesión para crear cuentas.'},401);
 try{const user=await deps.verifyToken(match[1]);if(!user)return reply({error:'La sesión ha caducado. Vuelve a entrar.'},401);const profile=await deps.getProfile(user.id);if(!profile||profile.role!=='admin'||!profile.family_id)return reply({error:'Solo el administrador de la familia puede crear cuentas.'},403);
 let b:any;try{const raw=await req.text();if(raw.length>8192)return reply({error:'Solicitud demasiado grande.'},413);b=JSON.parse(raw)}catch{return reply({error:'Solicitud no válida.'},400)}
 if(!b||typeof b.name!=='string'||b.name.trim().length<1||b.name.trim().length>80||typeof b.email!=='string'||b.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return reply({error:'Introduce nombre, correo válido y una contraseña inicial de entre 12 y 128 caracteres.'},400);
 const email=b.email.trim().toLowerCase(),name=b.name.trim();let created:{id:string};try{created=await deps.createUser(email,b.password,name)}catch{return reply({error:'No se pudo crear la cuenta. Comprueba los datos y que el correo no esté registrado.'},409)}
 try{await deps.insertProfile({id:created.id,family_id:profile.family_id,name,email,role:'member'})}catch{try{await deps.deleteUser(created.id)}catch{return reply({error:'El alta quedó incompleta. El propietario debe revisar ese correo en Supabase Authentication antes de repetirla.'},500)}return reply({error:'No se pudo completar el alta. No se ha guardado la cuenta; puedes volver a intentarlo.'},500)}
 return reply({ok:true,member:{id:created.id,name,email,role:'member'}},201);
 }catch{return reply({error:'No se pudo completar la operación. Inténtalo de nuevo.'},500)}
 }
}
