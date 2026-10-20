export function recoveryCallback(href:string){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 return {requested:hash.get('type')==='recovery',invalid:!!(hash.get('error')||hash.get('error_code')||url.searchParams.get('error')||url.searchParams.get('error_code'))};
}
export function recoverySession(raw:string|null,userId:string,now=Date.now()){
 try{const value=JSON.parse(raw||'null');return value?.userId===userId&&typeof value.until==='number'&&value.until>now&&value.until<=now+30*60*1000}catch{return false}
}
export async function saveRecoveredPassword(password:string,confirmation:string,update:(input:{password:string;data:{must_change_password:boolean}})=>Promise<{error:unknown}>){
 if(password.length<12||password.length>128)throw Error('La contraseña debe tener entre 12 y 128 caracteres.');
 if(password!==confirmation)throw Error('Las contraseñas no coinciden.');
 const result=await update({password,data:{must_change_password:false}});
 if(result.error)throw result.error;
}
export function authMessage(error:unknown){
 const e=error as {message?:string;code?:string;status?:number};
 if(e?.code==='same_password')return 'Elige una contraseña diferente a la anterior.';
 if(e?.status===429||/rate limit|too many requests/i.test(e?.message||''))return 'Has hecho demasiados intentos. Espera unos minutos antes de volver a solicitar el enlace.';
 if(/expired|session missing|invalid.*token|otp_expired/i.test(e?.message||'')||e?.code==='otp_expired')return 'El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo.';
 if(e?.message==='Invalid login credentials')return 'Correo o contraseña incorrectos.';
 if(e?.message==='Email not confirmed')return 'Confirma tu correo antes de entrar.';
 return e?.message||'No se pudo completar la operación. Vuelve a intentarlo.';
}
