import {useEffect,useState} from 'react';
import {supabase} from './backend';
const base=import.meta.env.BASE_URL;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
export async function disconnectPush(){
 if(!('serviceWorker'in navigator)||!supabase)return;
 const reg=await navigator.serviceWorker.getRegistration(base),sub=await reg?.pushManager.getSubscription();
 if(sub){const {error}=await supabase.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe()}
}
export default function PushSettings({owner}:{owner:boolean}){
 const [status,setStatus]=useState<any>({}),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 async function refresh(){
  const {data,error}=await supabase!.rpc('push_status');
  if(error){setMessage('Falta instalar la configuración push en Supabase. El propietario tiene las instrucciones más abajo.');return}
  setStatus(data||{});
  if(supported){const reg=await navigator.serviceWorker.getRegistration(base),sub=await reg?.pushManager.getSubscription();
   if(sub){const {data}=await supabase!.from('push_subscriptions').select('id').eq('endpoint',sub.endpoint);setActive(!!data?.length)}else setActive(false)}
 }
 useEffect(()=>{refresh().catch(()=>setMessage('No se pudo comprobar el estado de los avisos.'))},[]);
 async function invoke(body:unknown){
  const {data,error}=await supabase!.functions.invoke('casa-push',{body});
  if(error||data?.error)throw Error(data?.error||'No se pudo contactar con el envío push. Comprueba que casa-push esté desplegada y configurada.');
  return data;
 }
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function enable(){
  // La solicitud se realiza directamente desde el botón, antes de cualquier petición de red.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Permite las notificaciones desde los ajustes de este sitio para recibir avisos.');
  const reg=await navigator.serviceWorker.register(base+'sw.js',{scope:base});
  await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const encoded=status.publicKey.replace(/-/g,'+').replace(/_/g,'/');
  const key=Uint8Array.from(atob(encoded+'='.repeat((4-encoded.length%4)%4)),c=>c.charCodeAt(0));
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const json=sub.toJSON();
  const {error}=await supabase!.rpc('register_push',{endpoint_value:sub.endpoint,p256dh_value:json.keys?.p256dh,auth_value:json.keys?.auth});
  if(error)throw Error(error.message);
  setActive(true);setMessage('Avisos activados en este dispositivo. Puedes cerrar Casa.');
 }
 return <section className="card"><h2>Avisos con Casa cerrada</h2>
 <p>Recibe los recordatorios de tus citas y de las citas compartidas, con la antelación elegida en Agenda.</p>
 <div className="notice">Por privacidad, el aviso solo indica que tienes un recordatorio. Abre Casa para consultar sus detalles.</div>
 {ios&&!installed()&&<p><strong>En iPhone o iPad:</strong> abre Casa en Safari, pulsa Compartir → Añadir a pantalla de inicio y entra desde su icono para activar los avisos.</p>}
 {!supported&&<p>Este navegador no permite avisos push en su estado actual. En iPhone, instala primero Casa en la pantalla de inicio.</p>}
 <p>Servidor: <strong>{status.publicKey?'Configurado':'Pendiente de configurar'}</strong> · Este dispositivo: <strong>{active?'Activado':'Sin activar'}</strong></p>
 {status.publicKey&&<><button disabled={busy||!supported||(ios&&!installed())} onClick={()=>run(active?async()=>{await disconnectPush();setActive(false);setMessage('Avisos desactivados en este dispositivo.')}:enable)}>{active?'Desactivar en este dispositivo':'Activar en este dispositivo'}</button>{active&&<button className="ghost" disabled={busy} onClick={()=>run(async()=>{const reg=await navigator.serviceWorker.getRegistration(base),sub=await reg?.pushManager.getSubscription();const r=await invoke({action:'test',endpoint:sub?.endpoint});setMessage(r.sent?'Prueba enviada. Comprueba las notificaciones del móvil.':'El proveedor no ha aceptado el aviso. Desactiva y vuelve a activar este dispositivo.');})}>Enviar prueba</button>}</>}
 {owner&&!status.publicKey&&<><p>Instala primero el SQL y la función de envío. Después pulsa este botón: las claves se generan y guardan únicamente en el servidor.</p><a href="https://github.com/jara-cyber/casa/blob/main/NOTIFICACIONES.md" target="_blank" rel="noreferrer">Instrucciones de activación del servidor</a><p><button disabled={busy} onClick={()=>run(async()=>{await invoke({action:'setup'});await refresh();setMessage('Servidor configurado. Activa ahora cada móvil.');})}>Activar servidor de avisos</button></p></>}
 {status.publicKey&&<p>Última comprobación del servidor: {status.lastDispatch?new Date(status.lastDispatch).toLocaleString('es-ES'):'Todavía no consta ninguna. Espera unos minutos y vuelve a comprobar.'} <button className="linkbutton" disabled={busy} onClick={()=>run(refresh)}>Actualizar estado</button></p>}
 {message&&<p className="notice" role="status">{message}</p>}
 <p>Los envíos se revisan cada minuto. Necesitas conexión y permisos de notificación; el sistema del móvil puede retrasarlos. No sustituye una alarma para avisos críticos.</p>
 </section>
}
