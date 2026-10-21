export type TaskReaction={task_id:string;user_id:string;reaction:string};
const options=[{id:'seen',emoji:'✓',label:'Visto'},{id:'perfect',emoji:'👌',label:'Perfecto'},{id:'volunteer',emoji:'🙋',label:'Lo hago yo'}];
export default function TaskReactions({taskId,taskText,reactions,members,meId,busy,onReact}:{taskId:string;taskText:string;reactions:TaskReaction[];members:{id:string;name:string}[];meId:string;busy:boolean;onReact:(reaction:string)=>void}){
 const selected=reactions.filter(r=>r.task_id===taskId),mine=selected.find(r=>r.user_id===meId)?.reaction;
 const person=(id:string)=>members.find(m=>m.id===id)?.name||'Miembro';
 return <div className="task-reactions" role="group" aria-label={'Reacciones a '+taskText}>
 <div className="reaction-actions">{options.map(option=>{const people=selected.filter(r=>r.reaction===option.id);return <button key={option.id} type="button" className={'reaction-button'+(mine===option.id?' selected':'')} aria-pressed={mine===option.id} aria-label={option.label+' en '+taskText+(mine===option.id?'. Pulsa para quitar tu reacción':'')} title={people.length?people.map(r=>person(r.user_id)).join(', '):option.label} disabled={busy} onClick={()=>onReact(option.id)}><span aria-hidden="true">{option.emoji}</span> {option.label}{people.length>0&&<span className="reaction-count">{people.length}</span>}</button>})}</div>
 {selected.length>0&&<div className="reaction-people" aria-live="polite">{selected.map(r=>{const option=options.find(o=>o.id===r.reaction);return <span key={r.user_id}><span aria-hidden="true">{option?.emoji}</span> {person(r.user_id)}{r.user_id===meId?' (tú)':''} · {option?.label}</span>})}</div>}
 </div>
}
