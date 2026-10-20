export async function pushFailure(error:unknown,data?:{error?:string}){
 const e=error as {context?:Response}|null;
 const status=e?.context?.status;
 let detail=data?.error||'';
 if(!detail&&e?.context){try{const body=await e.context.clone().json();detail=typeof body.error==='string'?body.error:typeof body.message==='string'?body.message:''}catch{}}
 const cooldown=/espera un minuto|wait.*minute|too many|rate.limit/i.test(detail)||status===429;
 if(cooldown)return {message:'Espera un minuto entre pruebas. El servidor está configurado; no necesitas volver a instalarlo.',cooldown:true};
 if(status===401)return {message:'La sesión no se ha podido validar. Cierra sesión, vuelve a entrar y activa de nuevo los avisos si es necesario.',cooldown:false};
 if(status===404)return {message:'No se encuentra la función casa-push en Supabase. Comprueba su nombre y despliegue.',cooldown:false};
 if(detail)return {message:detail,cooldown:false};
 if(status)return {message:'El servidor de avisos ha respondido con un error ('+status+'). Revisa los registros de casa-push en Supabase.',cooldown:false};
 return {message:'No se pudo conectar con el envío push. Comprueba tu conexión y vuelve a intentarlo. Si persiste, revisa CORS y el despliegue de casa-push.',cooldown:false};
}
