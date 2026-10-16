type Input={name:string;email:string;password:string};
type Services={invite:(email:string,name:string)=>Promise<string>;signUp:(body:{email:string;password:string;options:{emailRedirectTo:string;data:{name:string;family_invite_code:string;must_change_password:boolean}}})=>Promise<{user:{id:string;identities?:unknown[]}|null;hasSession:boolean}>;join:(code:string)=>Promise<void>};
export async function provisionMember(input:Input,services:Services,redirectTo:string){const name=input.name.trim(),email=input.email.trim().toLowerCase();if(!name||name.length>80||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||input.password.length<12||input.password.length>128)throw Error('Revisa nombre, correo y contraseña de entre 12 y 128 caracteres.');
 // invite_member valida el administrador y elige su familia en PostgreSQL.
 const inviteCode=await services.invite(email,name);
 const signup=await services.signUp({email,password:input.password,options:{emailRedirectTo:redirectTo,data:{name,family_invite_code:inviteCode,must_change_password:true}}});
 if(!signup.user)throw Error('No se pudo completar el registro. Inténtalo de nuevo.');
 if(signup.user.identities?.length===0)return {name,email,inviteCode,status:'existing' as const};
 if(signup.hasSession){await services.join(inviteCode);return {name,email,inviteCode,status:'active' as const}}
 return {name,email,inviteCode,status:'confirmation' as const};
}
