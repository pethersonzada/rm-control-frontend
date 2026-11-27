import {useState,type FormEvent} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "../components/QueryState";
import type {OperationalPolicy} from "../domain/types";

function PolicyForm({value}:{value:OperationalPolicy}){
  const {remote}=useWorkspace();
  const client=useQueryClient();
  const [draft,setDraft]=useState(value);
  const [holidays,setHolidays]=useState(value.holidays.join("\n"));
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!remote)return;
    setBusy(true);setError("");setNotice("");
    try{
      const dates=[...new Set(holidays.split(/[\s,;]+/).filter(Boolean))];
      if(dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)))throw new Error("Use datas AAAA-MM-DD nos feriados.");
      const saved=await remote.savePolicy({...draft,holidays:dates,reference:draft.reference.trim()});
      setDraft(saved);setHolidays(saved.holidays.join("\n"));setNotice("Configuração salva.");
      client.setQueryData(["operational-policy"],saved);
      await client.invalidateQueries({queryKey:["summary"]});await client.invalidateQueries({queryKey:["records"]});
    }catch(caught){setError((caught as Error).message);}
    finally{setBusy(false);}
  }
  return <form className="panel stack" onSubmit={submit}>
    <h2>Calendário e prazo dos chamados</h2>
    <p>Ative somente após conferir a regra oficial. O cálculo conta dias úteis a partir do primeiro dia útil após a data inicial. Não muda o status automaticamente.</p>
    <fieldset disabled={busy} className="filter-grid">
      <label className="checkbox"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Ativar cálculo de prazo</label>
      <label>Dias úteis<input type="number" required min={0} max={365} step={1} value={draft.days} onChange={e=>setDraft({...draft,days:Number(e.target.value)})}/></label>
      <label>Data inicial<select value={draft.start_field} onChange={e=>setDraft({...draft,start_field:e.target.value as OperationalPolicy["start_field"]})}><option value="received_at">Recebimento</option><option value="included_at">Inclusão</option></select></label>
      <label>Fuso horário<input required maxLength={80} value={draft.timezone} onChange={e=>setDraft({...draft,timezone:e.target.value})}/></label>
      <label>Feriados (AAAA-MM-DD, um por linha)<textarea rows={5} value={holidays} onChange={e=>setHolidays(e.target.value)}/></label>
      <label>Referência da regra validada<input required maxLength={500} value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label>
    </fieldset>
    <button className="primary" disabled={busy}>Salvar configuração</button>
    {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  </form>;
}
export default function Settings(){
  const {remote}=useWorkspace();
  const q=useQuery({queryKey:["operational-policy"],queryFn:({signal})=>remote!.policy(signal)});
  return <><h1>Configurações operacionais</h1><QueryState loading={q.isPending} error={q.error} retry={()=>void q.refetch()}/>{q.data&&<PolicyForm value={q.data}/>}</>;
}
