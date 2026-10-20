import {useState} from 'react';
import {supabase} from './backend';
type Target={id:string;email:string};
export default function AdminPassword({target,onClose,onSaved}:{target:Target;onClose:()=>void;onSaved:()=>void}){
 const [confirmation,setConfirmation]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="password-title"><section className="dialog">
 <h2 id="password-title">Establecer nueva contraseña</h2><p>Cuenta: <strong>{target.email}</strong></p>
 <p>No se envía un correo. Si cambias la de otra persona, entrará con la contraseña que le facilites y Casa le pedirá elegir una nueva. No podrás consultar su contraseña anterior.</p>
 <form className="formgrid" onSubmit={async e=>{
  e.preventDefault();if(!supabase)return;setError('');
  if(password!==repeat){setError('Las contraseñas no coinciden.');return}
  if(password.length<12||password.length>128){setError('Usa entre 12 y 128 caracteres.');return}
  if(confirmation!==target.email){setError('El correo de confirmación no coincide.');return}
  setBusy(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw Error('Tu sesión ha caducado. Vuelve a entrar.');
   if(user.id===target.id){
    const {error}=await supabase.auth.updateUser({password,data:{must_change_password:false}});if(error)throw error;
   }else{
    const {data,error}=await supabase.functions.invoke('casa-admin',{body:{action:'password',userId:target.id,confirmEmail:confirmation,password}});
    if(error){
     let detail='';try{const body=await error.context?.json();detail=body?.error||''}catch{}
     throw Error(detail||'No se pudo contactar con casa-admin. El propietario debe desplegar la función de cambio de contraseñas en Supabase.');
    }
    if(data?.error||!data?.ok)throw Error(data?.error||'No se pudo confirmar el cambio.');
   }
   setPassword('');setRepeat('');onSaved();
  }catch(e){setError((e as Error).message||'No se pudo cambiar la contraseña.')}finally{setBusy(false)}
 }}>
 <label className="full">Confirma el correo de esta cuenta<input type="email" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} required/></label>
 <label className="full">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} required/></label>
 <label className="full">Repite la nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)} disabled={busy} required/></label>
 {error&&<p className="error full" role="alert">{error}</p>}
 <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancelar</button>
 <button disabled={busy||confirmation!==target.email}>{busy?'Guardando…':'Cambiar contraseña'}</button>
 </form></section></div>
}
