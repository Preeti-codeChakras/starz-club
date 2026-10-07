"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type League = {
  id: string; club_id: string; name: string; organizer_name: string | null;
  description: string | null; registration_start: string | null; registration_end: string | null;
  league_start: string | null; league_end: string | null; players_per_team: number | null;
  registration_status: "Draft" | "Open" | "Closed";
  status: "Upcoming" | "Active" | "Completed" | "Cancelled"; created_at: string;
};

type LeagueForm = {
  name: string; organizer_name: string; description: string; registration_start: string;
  registration_end: string; league_start: string; league_end: string; players_per_team: string;
  registration_status: "Draft" | "Open" | "Closed";
};

const emptyForm: LeagueForm = { name:"", organizer_name:"", description:"", registration_start:"", registration_end:"", league_start:"", league_end:"", players_per_team:"", registration_status:"Draft" };

function prettyDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}

export default function LeaguesPage() {
  const [leagues,setLeagues]=useState<League[]>([]);
  const [canManage,setCanManage]=useState(false);
  const [clubId,setClubId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [form,setForm]=useState<LeagueForm>(emptyForm);

  const loadPage=useCallback(async()=>{
    setLoading(true); setMessage("");
    const [{data:clubData,error:clubError},{data:permissionData,error:permissionError}]=await Promise.all([
      supabase.rpc("current_user_club_id"), supabase.rpc("can_current_user_manage_leagues")
    ]);
    if(clubError||permissionError){setMessage(clubError?.message||permissionError?.message||"Unable to verify league permissions.");setLoading(false);return;}
    const currentClubId=typeof clubData==="string"?clubData:null;
    setClubId(currentClubId); setCanManage(permissionData===true);
    const {data,error}=await supabase.from("leagues").select("id, club_id, name, organizer_name, description, registration_start, registration_end, league_start, league_end, players_per_team, registration_status, status, created_at").order("league_start",{ascending:false}).order("created_at",{ascending:false});
    if(error)setMessage(error.message); else setLeagues((data??[]) as League[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void loadPage();},[loadPage]);
  const openCount=useMemo(()=>leagues.filter(x=>x.registration_status==="Open").length,[leagues]);

  async function createLeague(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setMessage("");
    if(!canManage||!clubId){setMessage("You do not have League Organizer permission.");return;}
    const name=form.name.trim(); if(!name){setMessage("League name is required.");return;}
    if(form.registration_start&&form.registration_end&&form.registration_end<form.registration_start){setMessage("Registration end date cannot be before the start date.");return;}
    if(form.league_start&&form.league_end&&form.league_end<form.league_start){setMessage("League end date cannot be before the start date.");return;}
    const playersPerTeam=form.players_per_team?Number(form.players_per_team):null;
    if(playersPerTeam!==null&&(!Number.isInteger(playersPerTeam)||playersPerTeam<1)){setMessage("Players per team must be a whole number greater than 0.");return;}
    setSaving(true);
    const {error}=await supabase.from("leagues").insert({club_id:clubId,name,organizer_name:form.organizer_name.trim()||null,description:form.description.trim()||null,registration_start:form.registration_start||null,registration_end:form.registration_end||null,league_start:form.league_start||null,league_end:form.league_end||null,players_per_team:playersPerTeam,registration_status:form.registration_status,status:"Upcoming"});
    setSaving(false);
    if(error){setMessage(`Unable to create league: ${error.message}`);return;}
    setForm(emptyForm); setShowCreate(false); await loadPage(); setMessage("League created successfully.");
  }

  const input="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";
  return <main className="min-h-screen bg-slate-50">
    <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 text-white"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="text-sm font-medium text-blue-100 hover:text-white">← Home</Link><h1 className="mt-2 text-2xl font-bold sm:text-3xl">🏆 Leagues & Tournaments</h1><p className="mt-1 text-sm text-blue-100">Registrations, temporary teams, and independent league schedules.</p></div>{canManage&&<button onClick={()=>setShowCreate(v=>!v)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-950 shadow-sm hover:bg-blue-50">{showCreate?"Cancel":"+ Create League"}</button>}</div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      {message&&<div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">{message}</div>}
      {showCreate&&canManage&&<section className="mb-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-slate-900">Create League</h2><p className="mt-1 mb-5 text-sm text-slate-600">Create the league first. Registration, players, teams and schedule will live in its workspace.</p><form onSubmit={createLeague} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">League name *</span><input required className={input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Indoor Cricket League 2027"/></label>
        <label><span className="mb-1 block text-sm font-medium">Organizer</span><input className={input} value={form.organizer_name} onChange={e=>setForm({...form,organizer_name:e.target.value})} placeholder="XYZ Cricket Academy"/></label>
        <label><span className="mb-1 block text-sm font-medium">Players per team</span><input type="number" min="1" className={input} value={form.players_per_team} onChange={e=>setForm({...form,players_per_team:e.target.value})} placeholder="7"/></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Description</span><textarea rows={3} className={input} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <label><span className="mb-1 block text-sm font-medium">Registration opens</span><input type="date" className={input} value={form.registration_start} onChange={e=>setForm({...form,registration_start:e.target.value})}/></label>
        <label><span className="mb-1 block text-sm font-medium">Registration closes</span><input type="date" className={input} value={form.registration_end} onChange={e=>setForm({...form,registration_end:e.target.value})}/></label>
        <label><span className="mb-1 block text-sm font-medium">League starts</span><input type="date" className={input} value={form.league_start} onChange={e=>setForm({...form,league_start:e.target.value})}/></label>
        <label><span className="mb-1 block text-sm font-medium">League ends</span><input type="date" className={input} value={form.league_end} onChange={e=>setForm({...form,league_end:e.target.value})}/></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Registration status</span><select className={input} value={form.registration_status} onChange={e=>setForm({...form,registration_status:e.target.value as LeagueForm["registration_status"]})}><option>Draft</option><option>Open</option><option>Closed</option></select></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>{setShowCreate(false);setForm(emptyForm)}} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving?"Creating...":"Create League"}</button></div>
      </form></section>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Total leagues</div><div className="mt-1 text-3xl font-bold text-blue-950">{leagues.length}</div></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Registration open</div><div className="mt-1 text-3xl font-bold text-blue-950">{openCount}</div></div><div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Your access</div><div className="mt-2 text-sm font-semibold text-blue-950">{canManage?"League Organizer":"View only"}</div></div></div>
      {loading?<div className="rounded-2xl bg-white p-8 text-center">Loading leagues...</div>:leagues.length===0?<div className="rounded-2xl border border-dashed border-blue-200 bg-white px-5 py-12 text-center"><div className="text-4xl">🏆</div><h2 className="mt-3 text-xl font-bold">No leagues yet</h2><p className="mt-2 text-sm text-slate-600">Create your first independent league or tournament.</p>{canManage&&<button onClick={()=>setShowCreate(true)} className="mt-5 rounded-xl bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white">+ Create League</button>}</div>:<div className="grid gap-4 lg:grid-cols-2">{leagues.map(l=><Link key={l.id} href={`/leagues/${l.id}`} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm hover:border-blue-300"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase text-blue-700">{l.organizer_name||"League"}</div><h2 className="mt-1 text-xl font-bold">{l.name}</h2></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">Registration {l.registration_status}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">League dates</div><div className="mt-1 font-medium">{prettyDate(l.league_start)}{l.league_end?` – ${prettyDate(l.league_end)}`:""}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Players / team</div><div className="mt-1 font-medium">{l.players_per_team??"Not set"}</div></div></div><div className="mt-5 flex justify-between border-t pt-4 text-sm"><span className="text-slate-500">{l.status}</span><span className="font-semibold text-blue-800">Manage League →</span></div></Link>)}</div>}
    </div>
  </main>;
}
