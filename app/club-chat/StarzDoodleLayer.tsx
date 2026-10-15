"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Point = [number, number];
type Stroke = { id: string; user_id: string; color: string; width: number; points: Point[] };
type EventRow = { id: string; user_id: string; action: "stroke" | "clear" | "undo"; color: string | null; width: number | null; points: Point[] | null; target_id: string | null; created_at: string };
const colors = ["#e11d48","#2563eb","#16a34a","#eab308","#111827","#ffffff"];
function project(rows: EventRow[]): Stroke[] {
 const strokes: Stroke[] = [];
 for (const r of [...rows].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))) {
  if(r.action==="clear") strokes.length=0;
  else if(r.action==="undo") { const i=strokes.findIndex(s=>s.id===r.target_id); if(i>=0) strokes.splice(i,1); }
  else if(r.points && r.color) strokes.push({id:r.id,user_id:r.user_id,color:r.color,width:r.width??4,points:r.points});
 }
 return strokes;
}
export default function StarzDoodleLayer({clubId,roomId,userId,enabled}:{clubId:string;roomId:string;userId:string;enabled:boolean}) {
 const [events,setEvents]=useState<EventRow[]>([]);
 const [color,setColor]=useState("#e11d48");
 const [width,setWidth]=useState(4);
 const [current,setCurrent]=useState<Point[]>([]);
 const [error,setError]=useState("");
 const active=useRef(false);
 const draft=useRef<Point[]>([]);
 const svgRef=useRef<SVGSVGElement>(null);
 const rowsRef=useRef<EventRow[]>([]);
 const key=roomId==="group"?"group":roomId;
 const add=useCallback((r:EventRow)=>setEvents(prev=>prev.some(e=>e.id===r.id)?prev:[...prev,r]),[]);
 useEffect(()=>{rowsRef.current=events},[events]);
 useEffect(()=>{
  let alive=true;setEvents([]);setCurrent([]);setError("");
  const query=supabase.from("starz_doodle_events").select("*").eq("club_id",clubId).eq("room_key",key).order("created_at",{ascending:true}).limit(2000);
  void query.then(({data,error})=>{if(!alive)return;if(error)setError(error.message);else setEvents(old=>{const map=new Map<string,EventRow>();for(const r of [...(data??[]),...old])map.set(r.id,r as EventRow);return [...map.values()]})});
  const ch=supabase.channel(`starz-doodle-${clubId}-${key}`)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"starz_doodle_events",filter:`club_id=eq.${clubId}`},payload=>{
    const row=payload.new as EventRow & {room_key:string};
    if(row.room_key===key)add(row);
   }).subscribe();
  return()=>{alive=false;void supabase.removeChannel(ch)};
 },[clubId,key,add]);
 const save=async(action:"stroke"|"clear"|"undo",points?:Point[],target_id?:string)=>{
  setError("");
  const {data,error}=await supabase.from("starz_doodle_events").insert({
   club_id:clubId,room_key:key,user_id:userId,action,
   color:action==="stroke"?color:null,width:action==="stroke"?width:null,
   points:action==="stroke"?points:null,target_id:target_id??null
  }).select("*").single();
  if(error)setError(error.message);
  else if(data)add(data as EventRow);
 };
 const getPoint=(e:React.PointerEvent<SVGSVGElement>):Point=>{
  const rect=e.currentTarget.getBoundingClientRect();
  return [Math.max(0,Math.min(1000,Math.round((e.clientX-rect.left)/rect.width*1000))),
          Math.max(0,Math.min(600,Math.round((e.clientY-rect.top)/rect.height*600)))];
 };
 const down=(e:React.PointerEvent<SVGSVGElement>)=>{
  if(!enabled)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  active.current=true;draft.current=[getPoint(e)];setCurrent(draft.current);
 };
 const move=(e:React.PointerEvent<SVGSVGElement>)=>{
  if(!active.current)return;
  draft.current=[...draft.current,getPoint(e)];setCurrent(draft.current);
 };
 const up=()=>{
  if(!active.current)return;
  active.current=false;
  const points=draft.current;
  draft.current=[];setCurrent([]);
  if(points.length)void save("stroke",points.length===1?[points[0],points[0]]:points);
 };
 const strokes=project(events);
 const mine=[...strokes].reverse().find(s=>s.user_id===userId);
 return <>
  <svg ref={svgRef} viewBox="0 0 1000 600" preserveAspectRatio="none"
   aria-label="Shared drawing canvas" onPointerDown={down} onPointerMove={move}
   onPointerUp={up} onPointerCancel={up}
   className={`absolute inset-0 z-[5] h-full w-full ${enabled?"cursor-crosshair":"pointer-events-none"}`}
   style={{touchAction:enabled?"none":"auto"}}>
   {strokes.map(s=><polyline key={s.id} points={s.points.map(p=>p.join(",")).join(" ")}
    fill="none" stroke={s.color} strokeWidth={s.width*2} strokeLinecap="round" strokeLinejoin="round" opacity=".58"/>)}
   {current.length>0&&<polyline points={current.map(p=>p.join(",")).join(" ")}
    fill="none" stroke={color} strokeWidth={width*2} strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>}
  </svg>
  {enabled&&<div className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center gap-2 rounded-xl border bg-white/95 p-2 shadow-lg" onPointerDown={e=>e.stopPropagation()}>
   {colors.map(c=><button key={c} type="button" aria-label={`Pen ${c}`} onClick={()=>{setColor(c)}} className={`h-7 w-7 rounded-full border-2 ${color===c?"border-slate-900":"border-slate-300"}`} style={{background:c}}/>)}
   <label className="text-xs">Pen <input aria-label="Pen width" type="range" min="2" max="14" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
   <button type="button" className="rounded border px-2 py-1 text-xs" disabled={!mine} onClick={()=>mine&&void save("undo",undefined,mine.id)}>↶ Undo mine</button>
   <button type="button" className="rounded border px-2 py-1 text-xs" onClick={()=>{if(window.confirm("Clear the drawing for everyone in this chat?"))void save("clear")}}>Clear all</button>
  </div>}
  {error&&<div role="alert" className="absolute left-2 top-2 z-30 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
 </>;
}
