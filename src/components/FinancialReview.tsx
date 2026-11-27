import {useState,type FormEvent} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "./QueryState";
import {money} from "../domain/money";
import type {FinanceReview,Occurrence} from "../domain/types";

const fields=[["approved","Aprovado"],["recovered","Recuperado"],["pending","Pendente"]] as const;
function formDecimal(value:string|null){
  if(value==null||!value.trim())return null;
  if(!/^-?\d+(?:[.,]\d{1,8})?$/.test(value.trim()))throw new Error("Use valores sem separador de milhar.");
  return value.trim().replace(",",".");
}
function ReviewForm({record,value}:{record:Occurrence;value:FinanceReview}){
  const {remote}=useWorkspace();
  const client=useQueryClient();
  const [draft,setDraft]=useState(value);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!remote)return;setBusy(true);setError("");setNotice("");
    try{
      const saved=await remote.saveFinance(record,{...draft,approved:formDecimal(draft.approved),recovered:formDecimal(draft.recovered),pending:formDecimal(draft.pending),reference:draft.reference.trim()});
      setDraft(saved);setNotice("Valores conferidos registrados.");
      client.setQueryData(["finance",record.destination,record.code],saved);
      await client.invalidateQueries({queryKey:["summary"]});await client.invalidateQueries({queryKey:["ticket-history"]});
    }catch(caught){setError((caught as Error).message);}
    finally{setBusy(false);}
  }
  return <form className="stack" onSubmit={submit}>
    <p>Informe apenas valores comprovados. Deixe em branco o que não foi confirmado. O saldo pendente não é calculado automaticamente.</p>
    <fieldset disabled={busy} className="filter-grid">
      {fields.map(([key,label])=><label key={key}>{label} (R$)<input inputMode="decimal" value={draft[key]??""} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
      <label>Referência da conferência financeira<input required maxLength={500} value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label>
    </fieldset>
    <button className="primary" disabled={busy}>Salvar valores conferidos</button>
    {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  </form>;
}
export function FinancialReview({record}:{record:Occurrence}){
  const {remote,identity}=useWorkspace();
  const [opened,setOpened]=useState(false);
  const q=useQuery({queryKey:["finance",record.destination,record.code],queryFn:({signal})=>remote!.finance(record,signal),enabled:opened&&Boolean(remote)});
  return <section className="stack ticket-history">
    <button onClick={()=>setOpened(x=>!x)} aria-expanded={opened}>{opened?"Ocultar conferência financeira":"Conferência financeira"}</button>
    {opened&&<><QueryState loading={q.isPending} error={q.error} retry={()=>void q.refetch()}/>
      {q.data&&(identity?.can_delegate_admin?<ReviewForm record={record} value={q.data}/>:<dl className="metrics">{fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{money(q.data![key])}</dd></div>)}</dl>)}</>}
  </section>;
}
