"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { uploadFinanceReceipt, viewFinanceReceipt } from "@/lib/supabase/financeStorage";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type Kind = "Income" | "Expense";
type Member = {id:string; name:string; email:string | null};
type Split = {transaction_id:string; member_id:string; amount_due:number; paid:boolean; paid_at:string|null; last_reminded_at:string|null};
type Transaction = {id:string; transaction_type:Kind; category:string; amount:number; transaction_date:string; paid_by_or_received_from:string|null; payer_member_id:string|null; description:string; receipt_url:string|null; team_id:string|null; season_id:string|null; split_expense:boolean; participant_count:number|null; amount_per_person:number|null};
type Form = {transaction_type:Kind; category:string; amount:string; transaction_date:string; paid_by_or_received_from:string; payer_member_id:string; description:string; split_expense:boolean; member_ids:string[]; receipt_url:string};
const categories=["Registration Fee","Birthday","Ground Fee","Food","Equipment","Jerseys","Trophies","Sponsorship","Donation","Other"];
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const today=()=>{const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const empty=():Form=>({transaction_type:"Expense",category:"Other",amount:"",transaction_date:today(),paid_by_or_received_from:"",payer_member_id:"",description:"",split_expense:false,member_ids:[],receipt_url:""});
const input="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";
function amounts(total:number, ids:string[]):Record<string,number>{const cents=Math.round(total*100), base=Math.floor(cents/ids.length), remainder=cents%ids.length; return Object.fromEntries(ids.map((id,i)=>[id,(base+(i<remainder?1:0))/100]));}

function ReceiptThumbnail({
  receiptPath,
  onOpen,
}: {
  receiptPath: string;
  onOpen: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const cleanPath = receiptPath.split("?")[0].toLowerCase();
  const isPdf = cleanPath.endsWith(".pdf");
  const isImage = /\\.(jpg|jpeg|png|webp|gif|avif)$/.test(cleanPath);
  const previewUrl = receiptPath.startsWith("http://") || receiptPath.startsWith("https://")
    ? receiptPath
    : supabase.storage.from("finance-receipts").getPublicUrl(receiptPath).data.publicUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View full receipt"
      className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-blue-300 hover:bg-blue-50"
    >
      <span className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
        {isImage && !imageFailed ? (
          <img
            src={previewUrl}
            alt="Receipt thumbnail"
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="flex flex-col items-center text-blue-800">
            <span className="text-2xl" aria-hidden="true">{isPdf ? "📄" : "🧾"}</span>
            <span className="text-[10px] font-semibold">{isPdf ? "PDF" : "Receipt"}</span>
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-blue-900">Receipt attached</span>
        <span className="text-xs text-slate-600">Click to view full receipt ↗</span>
      </span>
    </button>
  );
}

export default function FinancePage(){
 const {profile,loadingProfile}=useCurrentProfile();
 const manager=profile?.appRole==="Admin"||profile?.appRole==="Treasurer";
 const [transactions,setTransactions]=useState<Transaction[]>([]),[members,setMembers]=useState<Member[]>([]),[splits,setSplits]=useState<Split[]>([]);
 const [season,setSeason]=useState<{id:string;name:string}|null>(null),[form,setForm]=useState<Form>(empty),[editing,setEditing]=useState<string|null>(null),[file,setFile]=useState<File|null>(null),[fileKey,setFileKey]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[search,setSearch]=useState(""),[filter,setFilter]=useState("All");
 const [selected,setSelected]=useState<Record<string,string[]>>({}),[sending,setSending]=useState<string|null>(null);
 const [memberSearch,setMemberSearch]=useState("");
 const [payerSearch,setPayerSearch]=useState("");
 const [payerOpen,setPayerOpen]=useState(false);
 const [splitOpen,setSplitOpen]=useState(false);
 const memberName=(id:string)=>members.find(m=>m.id===id)?.name??"Unknown member";
 const load=useCallback(async()=>{
  setLoading(true);
  const [t,p,s,e]=await Promise.all([
   supabase.from("finance_transactions").select("*").order("transaction_date",{ascending:false}),
   supabase.from("members").select("id,name,email"),
   supabase.from("finance_expense_members").select("*"),
   supabase.from("seasons").select("id,name").eq("active",true).limit(1).maybeSingle()
  ]);
  const errors=[t.error,p.error,s.error,e.error].filter(Boolean).map(x=>x!.message);
  if(!t.error)setTransactions((t.data??[]) as Transaction[]);
  if(!s.error)setSplits((s.data??[]) as Split[]);
  if(!e.error)setSeason(e.data);
  if(!p.error){
   const rows=(p.data??[]) as Record<string,unknown>[];
   setMembers(rows.map(r=>({id:String(r.id??""),name:typeof r.name==="string"&&r.name.trim()?r.name.trim():"Unnamed member",email:typeof r.email==="string"?r.email:null})).filter(m=>m.id).sort((a,b)=>a.name.localeCompare(b.name)));
  }
  if(errors.length)setMessage(errors.join(" | "));
  setLoading(false);
 },[]);
 useEffect(()=>{if(!loadingProfile&&profile)void load();else if(!loadingProfile)setLoading(false)},[loadingProfile,profile?.userId,load]);
 const totals=useMemo(()=>transactions.reduce((a,t)=>{if(t.transaction_type==="Income")a.income+=Number(t.amount);else a.expenses+=Number(t.amount);return a},{income:0,expenses:0}),[transactions]);
 const shown=transactions.filter(t=>(filter==="All"||t.transaction_type===filter)&&[t.description,t.category,t.paid_by_or_received_from??"",...(splits.filter(s=>s.transaction_id===t.id).map(s=>memberName(s.member_id)))].join(" ").toLowerCase().includes(search.toLowerCase()));
 const txSplits=(id:string)=>splits.filter(s=>s.transaction_id===id);
 const reset=()=>{setForm(empty());setEditing(null);setFile(null);setFileKey(k=>k+1);setMemberSearch("");setPayerSearch("");setPayerOpen(false);setSplitOpen(false)};
 function edit(t:Transaction){setEditing(t.id);setForm({transaction_type:t.transaction_type,category:t.category,amount:String(t.amount),transaction_date:t.transaction_date,paid_by_or_received_from:t.paid_by_or_received_from??"",payer_member_id:t.payer_member_id??"",description:t.description,split_expense:t.split_expense,member_ids:txSplits(t.id).map(s=>s.member_id),receipt_url:t.receipt_url??""});setFile(null);setFileKey(k=>k+1);setPayerOpen(false);setSplitOpen(false);window.scrollTo({top:0,behavior:"smooth"});}
 async function save(e:FormEvent){e.preventDefault();if(!manager||busy)return;const amount=Number(form.amount);if(!Number.isFinite(amount)||amount<=0||!form.description.trim()||!form.transaction_date){setMessage("Please enter a valid amount, date and description.");return}
  const isSplit=form.transaction_type==="Expense"&&form.split_expense;
  if(isSplit&&!form.member_ids.length){setMessage("Select at least one member to split this expense.");return}
  if(isSplit&&new Set(form.member_ids).size!==form.member_ids.length){setMessage("Duplicate members selected.");return}
  setBusy(true);setMessage("");let path=form.receipt_url;let newUpload="";
  try{
   if(file){path=await uploadFinanceReceipt(file);newUpload=path;}
   const count=isSplit?form.member_ids.length:null;
   const data={transaction_type:form.transaction_type,category:form.category,amount,transaction_date:form.transaction_date,paid_by_or_received_from:form.payer_member_id?memberName(form.payer_member_id):(form.paid_by_or_received_from.trim()||null),payer_member_id:form.payer_member_id||null,description:form.description.trim(),receipt_url:path||null,team_id:null,season_id:season?.id??null,split_expense:isSplit,participant_count:count,amount_per_person:count?Math.round(amount/count*100)/100:null};
   let id=editing;
   if(editing){const {error}=await supabase.from("finance_transactions").update(data).eq("id",editing);if(error)throw error;}
   else {const {data:created,error}=await supabase.from("finance_transactions").insert(data).select("id").single();if(error)throw error;id=created.id;}
   if(!id)throw new Error("Missing transaction ID");
   const existing=txSplits(id);const chosen=new Set(isSplit?form.member_ids:[]);
   const removed=existing.filter(s=>!chosen.has(s.member_id));
   if(removed.length){const {error}=await supabase.from("finance_expense_members").delete().eq("transaction_id",id).in("member_id",removed.map(s=>s.member_id));if(error)throw error;}
   if(isSplit){const dues=amounts(amount,form.member_ids);const rows=form.member_ids.map(member_id=>{const old=existing.find(s=>s.member_id===member_id);return {transaction_id:id,member_id,amount_due:dues[member_id],paid:old?.paid??false,paid_at:old?.paid_at??null,last_reminded_at:old?.last_reminded_at??null};});const {error}=await supabase.from("finance_expense_members").upsert(rows,{onConflict:"transaction_id,member_id"});if(error)throw error;}
   reset();await load();setMessage("Transaction and member shares saved successfully.");
  }catch(err){setMessage(`Save failed: ${err instanceof Error?err.message:String(err)}. If the transaction saved but shares failed, edit it and retry.`);if(newUpload&&!newUpload.startsWith("http"))await supabase.storage.from("finance-receipts").remove([newUpload]);}
  finally{setBusy(false)}
 }
 async function mark(t:Transaction,s:Split){if(!manager)return;const paid=!s.paid;const {error}=await supabase.from("finance_expense_members").update({paid,paid_at:paid?new Date().toISOString():null}).eq("transaction_id",t.id).eq("member_id",s.member_id);if(error)setMessage(error.message);else await load();}
 async function remove(t:Transaction){if(!manager||!window.confirm(`Delete ${t.description}?`))return;const {error}=await supabase.from("finance_transactions").delete().eq("id",t.id);if(error)setMessage(error.message);else{if(editing===t.id)reset();await load();setMessage("Transaction deleted.")}}
 async function remind(t:Transaction){const ids=(selected[t.id]??[]).filter(id=>txSplits(t.id).some(s=>s.member_id===id&&!s.paid));if(!ids.length)return;setSending(t.id);setMessage("");try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("Please sign in again");const res=await fetch("/api/finance/reminders",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({transactionId:t.id,memberIds:ids})});const result=await res.json();if(!res.ok)throw new Error(result.error??"Reminder failed");setMessage(`Sent ${result.sent} reminder(s). ${result.failed?.length?`Failed: ${result.failed.join(", ")}`:""}`);setSelected(prev=>({...prev,[t.id]:[]}));await load();}catch(err){setMessage(err instanceof Error?err.message:String(err))}finally{setSending(null)}}
 const preview=form.member_ids.length&&Number(form.amount)>0?amounts(Number(form.amount),form.member_ids):{};
 if(loadingProfile)return <main className="p-8">Checking account…</main>;
 if(!profile)return <main className="p-8"><Link href="/auth" className="text-blue-800 underline">Sign in to view finances</Link></main>;
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl"><Link href="/" className="text-blue-700">← Back to Home</Link><h1 className="mt-5 text-3xl font-bold text-blue-900">💰 Club Finances</h1><p className="mt-2 text-slate-600">Track transactions, receipts, member balances and reminders{season?` · ${season.name}`:""}.</p>
 <div className="mt-6 grid gap-3 sm:grid-cols-3">{[["Total Income",totals.income],["Total Expenses",totals.expenses],["Current Balance",totals.income-totals.expenses]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold text-blue-900">{money(Number(value))}</p></div>)}</div>
 {message&&<p role="alert" className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}
 <div className={`mt-8 grid items-start gap-8 ${manager?"lg:grid-cols-[1.15fr_0.85fr]":""}`}><section><h2 className="text-2xl font-semibold">Transaction history</h2><p className="text-sm text-slate-600">{shown.length} transaction(s)</p><div className="mt-4 flex flex-wrap gap-2"><input aria-label="Search transactions" className={`${input} flex-1`} placeholder="Search expense, category or member" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter transactions" className={input} value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Income</option><option>Expense</option></select></div>
 {loading?<p className="mt-5">Loading…</p>:shown.length===0?<p className="mt-5">No matching transactions.</p>:<div className="mt-5 space-y-4">{shown.map(t=>{const ss=txSplits(t.id),unpaid=ss.filter(s=>!s.paid),checked=selected[t.id]??[];return <article key={t.id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{t.transaction_type} · {t.category}</p><h3 className="mt-2 text-lg font-bold text-blue-900">{t.description}</h3><p className="text-sm text-slate-600">{t.transaction_date}</p>{t.paid_by_or_received_from&&<p className="mt-2 text-sm">{t.transaction_type==="Expense"?"Paid by":"Received from"}: {t.paid_by_or_received_from}</p>}</div><strong className={t.transaction_type==="Expense"?"text-2xl text-red-700":"text-2xl text-green-700"}>{t.transaction_type==="Expense"?"-":"+"}{money(Number(t.amount))}</strong></div>
 {t.receipt_url && (
  <ReceiptThumbnail
    receiptPath={t.receipt_url}
    onOpen={() =>
      void viewFinanceReceipt(t.receipt_url!).catch((error) =>
        setMessage(error instanceof Error ? error.message : String(error))
      )
    }
  />
)}
 {t.split_expense&&<div className="mt-4 rounded-lg bg-blue-50 p-3"><p className="font-medium text-blue-900">Shared expense · {ss.length?`${ss.length} assigned member(s)`:`${t.participant_count??0} unassigned participant(s)`}</p>{ss.length===0?<p className="mt-2 text-sm">Legacy expense: click Edit and assign members to enable payment tracking.</p>:<><p className="mt-1 text-sm">{ss.filter(s=>s.paid).length} paid · {unpaid.length} unpaid · Outstanding {money(unpaid.reduce((n,s)=>n+Number(s.amount_due),0))}</p><div className="mt-3 space-y-2">{ss.map(s=><div key={s.member_id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" aria-label={`Select ${memberName(s.member_id)} for reminder`} disabled={!manager||s.paid} checked={checked.includes(s.member_id)&&!s.paid} onChange={e=>setSelected(prev=>({...prev,[t.id]:e.target.checked?[...new Set([...(prev[t.id]??[]),s.member_id])]: (prev[t.id]??[]).filter(id=>id!==s.member_id)}))}/><span>{memberName(s.member_id)} · {money(Number(s.amount_due))}</span></label>{manager?<button className={`rounded px-2 py-1 ${s.paid?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800"}`} onClick={()=>void mark(t,s)}>{s.paid?"Paid ✓ (undo)":"Mark paid"}</button>:<span>{s.paid?"Paid":"Unpaid"}</span>}</div>)}</div>{manager&&unpaid.length>0&&<div className="mt-3 flex flex-wrap gap-2"><button className="rounded border border-blue-800 px-3 py-2 text-sm text-blue-800" onClick={()=>setSelected(prev=>({...prev,[t.id]:unpaid.map(s=>s.member_id)}))}>Select all unpaid</button><button disabled={!checked.some(id=>unpaid.some(s=>s.member_id===id))||sending===t.id} className="rounded bg-blue-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={()=>void remind(t)}>{sending===t.id?"Sending…":"Email selected reminders"}</button></div>}</>}</div>}
 {manager&&<div className="mt-4 flex gap-2"><button className="rounded border border-blue-800 px-4 py-2 text-blue-800" onClick={()=>edit(t)}>Edit</button><button className="rounded border border-red-600 px-4 py-2 text-red-700" onClick={()=>void remove(t)}>Delete</button></div>}</article>})}</div>}</section>
 {manager&&<section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-blue-900">{editing?"Edit":"Add"} transaction</h2><form onSubmit={save} className="mt-4 grid gap-4"><label className="text-sm font-medium">Type<select className={input} value={form.transaction_type} onChange={e=>setForm(f=>({...f,transaction_type:e.target.value as Kind,split_expense:e.target.value==="Expense"&&f.split_expense}))}><option>Expense</option><option>Income</option></select></label><label className="text-sm font-medium">Category<select className={input} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Amount ($)<input required min="0.01" step="0.01" type="number" className={input} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label className="text-sm font-medium">Date<input required type="date" className={input} value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></label></div>
 <div className="text-sm font-medium">
  <span>{form.transaction_type === "Expense" ? "Paid by member" : "Received from member"}</span>
  <button type="button" aria-expanded={payerOpen} onClick={() => setPayerOpen(v => !v)} className={`${input} flex items-center justify-between text-left`}>
    <span>{form.payer_member_id ? memberName(form.payer_member_id) : "Other / enter manually"}</span>
    <span aria-hidden="true">{payerOpen ? "▲" : "▼"}</span>
  </button>
  {payerOpen && <div className="mt-2 rounded-lg border bg-white p-3 shadow-sm">
    <label htmlFor="payer-search" className="block text-sm">Search payer</label>
    <input id="payer-search" type="search" className={input} placeholder="Type a member name..." value={payerSearch} onChange={e => setPayerSearch(e.target.value)} />
    <div className="mt-2 max-h-44 overflow-y-auto">
      <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-100" onClick={() => {setForm(f => ({...f,payer_member_id:""}));setPayerSearch("");setPayerOpen(false)}}>Other / enter manually</button>
      {members.filter(m => m.name.toLowerCase().includes(payerSearch.trim().toLowerCase())).map(m => <button key={m.id} type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-blue-50" onClick={() => {setForm(f => ({...f,payer_member_id:m.id,paid_by_or_received_from:""}));setPayerSearch("");setPayerOpen(false)}}>{m.name}</button>)}
    </div>
    <button type="button" className="mt-2 rounded border px-3 py-2 text-sm" onClick={() => setPayerOpen(false)}>Done</button>
  </div>}
 </div>
 {!form.payer_member_id&&<label className="text-sm font-medium">Name (if not a registered member)<input className={input} value={form.paid_by_or_received_from} onChange={e=>setForm(f=>({...f,paid_by_or_received_from:e.target.value}))}/></label>}
 {form.transaction_type === "Expense" && <div className="rounded-lg bg-slate-50 p-3">
  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.split_expense} onChange={e => {setForm(f => ({...f,split_expense:e.target.checked}));if(!e.target.checked)setSplitOpen(false)}} />Split expense among members</label>
  {form.split_expense && <div className="mt-3 space-y-3">
    <p className="text-sm font-medium text-blue-900">{form.member_ids.length} member(s) selected</p>
    {form.member_ids.length > 0 && <div className="flex flex-wrap gap-2">{form.member_ids.map(id => <button key={id} type="button" title={`Remove ${memberName(id)}`} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900" onClick={() => setForm(f => ({...f,member_ids:f.member_ids.filter(x => x !== id)}))}>{memberName(id)} ×</button>)}</div>}
    <button type="button" aria-expanded={splitOpen} onClick={() => setSplitOpen(v => !v)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm font-medium text-blue-900 hover:bg-blue-50">{splitOpen ? "Done selecting ▲" : "Search / Edit members ▼"}</button>
    {splitOpen && <div className="rounded-lg border bg-white p-3 shadow-sm">
      <label htmlFor="split-member-search" className="block text-sm font-medium">Search members</label>
      <input id="split-member-search" type="search" className={input} placeholder="Type a member name..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {members.filter(m => m.name.toLowerCase().includes(memberSearch.trim().toLowerCase())).map(m => <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-blue-50"><input type="checkbox" checked={form.member_ids.includes(m.id)} onChange={e => setForm(f => ({...f,member_ids:e.target.checked?[...new Set([...f.member_ids,m.id])]:f.member_ids.filter(id => id !== m.id)}))}/>{m.name}</label>)}
        {!members.length && <p className="text-sm text-slate-500">No members found. Check access policies.</p>}
        {members.length > 0 && !members.some(m => m.name.toLowerCase().includes(memberSearch.trim().toLowerCase())) && <p className="text-sm text-slate-500">No matching members.</p>}
      </div>
      <button type="button" className="mt-3 w-full rounded-lg bg-blue-900 px-4 py-2 text-sm text-white" onClick={() => {setSplitOpen(false);setMemberSearch("")}}>Done</button>
    </div>}
    {form.member_ids.length > 0 && <p className="text-sm text-slate-600">Total {money(Number(form.amount)||0)} · {form.member_ids.length} shares: {Object.values(preview).map(n=>money(n)).join(" / ")}</p>}
  </div>}
 </div>}
 <label className="text-sm font-medium">Description<textarea required rows={3} className={input} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></label><label className="text-sm font-medium">Receipt (JPG, PNG, WebP, PDF; max 10 MB)<input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={input} onChange={e=>{const f=e.target.files?.[0]??null;if(f&&(f.size>10485760||!["image/jpeg","image/png","image/webp","application/pdf"].includes(f.type))){setMessage("Unsupported receipt or file larger than 10 MB.");setFile(null);setFileKey(k=>k+1);}else setFile(f)}}/></label>{file&&<p className="text-sm">Selected: {file.name}</p>}{form.receipt_url&&<button type="button" className="text-left text-sm text-blue-700 underline" onClick={()=>void viewFinanceReceipt(form.receipt_url).catch(e=>setMessage(e.message))}>View existing receipt</button>}
 <div className="flex gap-2"><button disabled={busy} type="submit" className="rounded bg-blue-900 px-5 py-3 text-white disabled:opacity-50">{busy?"Saving…":editing?"Update transaction":"Add transaction"}</button>{editing&&<button type="button" className="rounded border px-4 py-3" onClick={reset}>Cancel</button>}</div></form></section>}</div></div></main>;
}



