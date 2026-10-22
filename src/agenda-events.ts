export function agendaEvents<T extends {kind:string;date:string}>(items:T[],now=Date.now()):T[]{
 return items.filter(item=>item.kind==='event'&&Number.isFinite(Date.parse(item.date))&&Date.parse(item.date)>=now)
 .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}
