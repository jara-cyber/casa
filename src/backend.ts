import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=Boolean(url&&key&&!url.includes('TU-PROYECTO')&&!key.includes('TU_CLAVE'));
export const supabase=configured?createClient(url,key):null;
export async function readHome(){if(!supabase)throw Error('Falta configurar Supabase');const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw Error('Inicia sesión');const {data:me,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();if(error)throw error;if(!me)throw Error('NO_FAMILY');const [{data:members,error:pe},{data:items,error:ie}]=await Promise.all([supabase.from('profiles').select('*'),supabase.from('items').select('*').order('created_at')]);if(pe||ie)throw pe||ie;return {me,members:members||[],items:(items||[]).map(x=>({...x,owner:x.owner_id,done:x.done?1:0}))}}
export async function writeHome(b:any){if(!supabase)throw Error('Falta configurar Supabase');let result:any;
if(b.action==='member'){result=await supabase.rpc('invite_member',{member_email:b.email,member_name:b.name});if(result.error)throw result.error;return {invite:result.data}}
if(b.action==='toggle')result=await supabase.rpc('toggle_item',{item_id:b.id});
else if(b.action==='delete')result=await supabase.from('items').delete().eq('id',b.id);
else if(b.action==='add'){const s=await readHome();if(b.kind==='link'&&!safeUrl(b.extra))throw Error('Usa un enlace http o https');result=await supabase.from('items').insert({family_id:s.me.family_id,owner_id:s.me.id,scope:b.scope,kind:b.kind,text:b.text.trim(),date:b.date||'',amount:b.kind==='expense'?Math.round(Number(b.amount)*100):0,done:!!b.done,reminder:b.reminder??1440,extra:b.extra||''})}else throw Error('Acción no válida');if(result.error)throw result.error;return {ok:true}}
export function safeUrl(url:string){try{return ['http:','https:'].includes(new URL(url).protocol)}catch{return false}}
