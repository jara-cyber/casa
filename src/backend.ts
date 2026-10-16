import {provisionMember} from './member-provisioning';
import publicConfig from './public-config.json';
import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.supabaseUrl,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||publicConfig.supabasePublishableKey;
export const configured=Boolean(url&&key&&!url.includes('TU-PROYECTO')&&!key.includes('TU_CLAVE'));
export const supabase=configured?createClient(url,key):null;
export async function readHome(){if(!supabase)throw Error('Falta configurar Supabase');const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw Error('Inicia sesión');const {data:me,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();if(error)throw error;if(!me)throw Error('NO_FAMILY');const [{data:members,error:pe},{data:items,error:ie}]=await Promise.all([supabase.from('profiles').select('*'),supabase.from('items').select('*').order('created_at')]);if(pe||ie)throw pe||ie;const invitationResult=me.role==='admin'?await supabase.from('family_invites').select('id,name,email,expires_at,used_at').is('used_at',null).gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}):{data:[],error:null};if(invitationResult.error)throw invitationResult.error;const sitePermission=await supabase.rpc('is_site_admin');return {me,siteAdmin:sitePermission.data===true,invites:invitationResult.data||[],members:members||[],items:(items||[]).map(x=>({...x,owner:x.owner_id,done:x.done?1:0}))}}
export async function writeHome(b:any){if(!supabase)throw Error('Falta configurar Supabase');let result:any;
if(b.action==='member'){result=await supabase.rpc('invite_member',{member_email:b.email,member_name:b.name});if(result.error)throw result.error;return {invite:result.data}}
if(b.action==='toggle')result=await supabase.rpc('toggle_item',{item_id:b.id});
else if(b.action==='delete')result=await supabase.from('items').delete().eq('id',b.id);
else if(b.action==='add'){const s=await readHome();if(b.kind==='link'&&!safeUrl(b.extra))throw Error('Usa un enlace http o https');result=await supabase.from('items').insert({family_id:s.me.family_id,owner_id:s.me.id,scope:b.scope,kind:b.kind,text:b.text.trim(),date:b.date||'',amount:b.kind==='expense'?Math.round(Number(b.amount)*100):0,done:!!b.done,reminder:b.reminder??1440,extra:b.extra||''})}else throw Error('Acción no válida');if(result.error)throw result.error;return {ok:true}}
export function safeUrl(url:string){try{return ['http:','https:'].includes(new URL(url).protocol)}catch{return false}}
export async function createMember(body:{name:string;email:string;password:string}){if(!supabase)throw Error('Falta configurar Supabase');const state=await readHome();if(state.me.role!=='admin')throw Error('Solo el administrador puede crear cuentas.');const registration=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'casa-provision-'+crypto.randomUUID()}});
try{return await provisionMember(body,{
async invite(email,name){const {data,error}=await supabase!.rpc('invite_member',{member_email:email,member_name:name});if(error)throw error;return data},
async signUp(input){const {data,error}=await registration.auth.signUp(input);if(error)throw error;return {user:data.user,hasSession:!!data.session}},
async join(code){const {error}=await registration.rpc('join_family',{invite_code:code});if(error)throw error}
},window.location.origin+import.meta.env.BASE_URL)}finally{await registration.auth.signOut({scope:'local'}).catch(()=>{});registration.auth.stopAutoRefresh()}}
