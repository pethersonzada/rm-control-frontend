import {useEffect,useRef,useState,type FormEvent} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "../components/QueryState";
import {ApiError} from "../services/api";
import type {SupplierCheck,SupplierCheckInput,SupplierFilters} from "../domain/types";

const emptyFilters:SupplierFilters={store:"",search:"",checker:"",from_date:"",to_date:"",include_cancelled:false};
function localDate(value=new Date().toISOString()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Recife",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
}
function labelDate(value:string){return new Date(value).toLocaleString("pt-BR",{timeZone:"America/Recife"});}
function blank(store:string):SupplierCheckInput{return {store,supplier_code:null,supplier_name:"",checker:"",checked_at:localDate(),reference:null,notes:null};}

function History({row,onClose}:{row:SupplierCheck;onClose:()=>void}){
  const {remote}=useWorkspace();
  const [cursors,setCursors]=useState([0]);
  const cursor=cursors.at(-1)??0;
  const q=useQuery({queryKey:["supplier-history",row.id,cursor],queryFn:({signal})=>remote!.supplierHistory(row.id,cursor,signal)});
  return <section className="panel stack" aria-label="Histórico da conferência">
    <div className="page-heading"><h2>Histórico da conferência {row.id}</h2><button onClick={onClose}>Fechar histórico</button></div>
    <QueryState loading={q.isPending} error={q.error} retry={()=>void q.refetch()}/>
    <ol className="stack">{q.data?.events.map((event,i)=><li key={i}>
      <strong>{event.action==="create"?"Registrada":event.action==="cancel"?"Cancelada":"Corrigida"}</strong>
      <p>{labelDate(event.created_at)}</p>{event.reason&&<p>Motivo: {event.reason}</p>}
      <p>{event.current.supplier_name} · {event.current.checker} · {labelDate(event.current.checked_at)}</p>
      {event.previous&&<details><summary>Registro anterior</summary><p>{event.previous.supplier_name} · {event.previous.checker} · {labelDate(event.previous.checked_at)}</p><p>{event.previous.reference??""} {event.previous.notes??""}</p></details>}
    </li>)}</ol>
    <div className="actions"><button disabled={cursors.length===1} onClick={()=>setCursors(x=>x.slice(0,-1))}>Mais recentes</button><button disabled={q.data?.next_cursor==null} onClick={()=>{if(q.data?.next_cursor!=null)setCursors(x=>[...x,q.data!.next_cursor!]);}}>Mais antigos</button></div>
  </section>;
}

export default function Suppliers(){
  const {remote,identity}=useWorkspace();
  const client=useQueryClient();
  const writable=identity?.role==="admin"||identity?.role==="importer";
  const [draft,setDraft]=useState(()=>blank(identity?.stores[0]??""));
  const [editing,setEditing]=useState<SupplierCheck|null>(null);
  const [changeReason,setChangeReason]=useState("");
  const [cancelled,setCancelled]=useState(false);
  const [filters,setFilters]=useState(emptyFilters);
  const [applied,setApplied]=useState(emptyFilters);
  const [cursors,setCursors]=useState([0]);
  const [history,setHistory]=useState<SupplierCheck|null>(null);
  const [busy,setBusy]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const locked=useRef(false);
  const key=useRef(crypto.randomUUID());
  const sent=useRef<string|null>(null);
  const downloadController=useRef<AbortController|null>(null);
  useEffect(()=>()=>downloadController.current?.abort(),[]);
  const cursor=cursors.at(-1)??0;
  const stores=useQuery({queryKey:["stores"],queryFn:({signal})=>remote!.stores(signal)});
  const list=useQuery({queryKey:["supplier-checks",applied,cursor],queryFn:({signal})=>remote!.supplierChecks(applied,cursor,signal)});
  const options=stores.data?.filter(s=>s.active&&identity?.stores.includes(s.code))??[];
  const set=<K extends keyof SupplierCheckInput>(field:K,value:SupplierCheckInput[K])=>setDraft(d=>({...d,[field]:value}));
  function reset(){
    setDraft(blank(identity?.stores[0]??""));setEditing(null);setChangeReason("");setCancelled(false);
    key.current=crypto.randomUUID();sent.current=null;setUncertain(false);
  }
  function startEdit(row:SupplierCheck){
    if(uncertain&&!window.confirm("A tentativa anterior pode ter sido gravada. Descartar o formulário?"))return;
    reset();setError("");setNotice("");setEditing(row);
    setDraft({store:row.store,supplier_code:row.supplier_code,supplier_name:row.supplier_name,checker:row.checker,checked_at:localDate(row.checked_at),reference:row.reference,notes:row.notes});
    setHistory(null);
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!remote||locked.current)return;
    if(cancelled&&!window.confirm("Cancelar esta conferência? O histórico será preservado."))return;
    locked.current=true;setBusy(true);setError("");setNotice("");
    try{
      const payload={...draft,supplier_name:draft.supplier_name.trim(),checker:draft.checker.trim(),supplier_code:draft.supplier_code?.trim()||null,reference:draft.reference?.trim()||null,notes:draft.notes?.trim()||null,checked_at:draft.checked_at+":00-03:00"};
      const digest=JSON.stringify(payload);
      if(!editing&&sent.current&&digest!==sent.current)throw new Error("Reenvie os mesmos dados ou confira a listagem antes de iniciar um novo registro.");
      if(!editing)sent.current=digest;
      if(editing)await remote.editSupplierCheck(editing.id,payload,editing.revision,!cancelled,changeReason.trim());
      else await remote.createSupplierCheck(payload,key.current);
      setNotice(editing?"Conferência atualizada.":"Conferência registrada.");
      reset();setCursors([0]);await client.invalidateQueries({queryKey:["supplier-checks"]});await client.invalidateQueries({queryKey:["supplier-history"]});
    }catch(caught){
      if(!editing && caught instanceof ApiError && [400,401,403,413,422,429].includes(caught.status)){sent.current=null;setUncertain(false);}
      else if(!editing&&sent.current)setUncertain(true);
      setError((caught as Error).message);
    }finally{locked.current=false;setBusy(false);}
  }
  async function exportFile(){
    if(!remote||exporting)return;
    setError("");setExporting(true);
    const controller=new AbortController();downloadController.current=controller;
    try{
      const blob=await remote.exportSuppliers(applied,controller.signal);
      if(controller.signal.aborted)return;
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="rm-control-fornecedores.xlsx";a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(caught){if(!controller.signal.aborted)setError((caught as Error).message);}
    finally{setExporting(false);downloadController.current=null;}
  }
  return <>
    <h1>Fornecedores conferidos</h1>
    <p className="muted">Registre somente conferências realizadas. Cada entrega pode ter um registro próprio. O nome do conferente pode ser diferente da pessoa que registra.</p>
    {writable&&<form className="panel stack" onSubmit={submit}>
      <h2>{editing?"Corrigir conferência "+editing.id:"Nova conferência"}</h2>
      <QueryState loading={stores.isPending} error={stores.error} retry={()=>void stores.refetch()}/>
      <fieldset disabled={busy||uncertain} className="filter-grid">
        <label>Loja<select aria-label="Loja da conferência" required disabled={!!editing} value={draft.store} onChange={e=>set("store",e.target.value)}><option value="">Selecione</option>{options.map(s=><option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select></label>
        <label>Código do fornecedor<input maxLength={80} value={draft.supplier_code??""} onChange={e=>set("supplier_code",e.target.value)}/></label>
        <label>Fornecedor<input required maxLength={200} value={draft.supplier_name} onChange={e=>set("supplier_name",e.target.value)}/></label>
        <label>Conferente<input required maxLength={200} value={draft.checker} onChange={e=>set("checker",e.target.value)}/></label>
        <label>Data e hora da conferência (Recife)<input required type="datetime-local" value={draft.checked_at} onChange={e=>set("checked_at",e.target.value)}/></label>
        <label>Referência da entrega (opcional)<input maxLength={120} value={draft.reference??""} onChange={e=>set("reference",e.target.value)}/></label>
        <label>Observação (opcional)<textarea maxLength={1000} rows={2} value={draft.notes??""} onChange={e=>set("notes",e.target.value)}/></label>
        {editing&&<><label>Motivo da alteração<input required maxLength={500} value={changeReason} onChange={e=>setChangeReason(e.target.value)}/></label><label className="checkbox"><input type="checkbox" checked={cancelled} onChange={e=>setCancelled(e.target.checked)}/>Cancelar conferência</label></>}
      </fieldset>
      {uncertain&&<p role="status">A gravação pode ter sido concluída. Reenvie a mesma solicitação ou confira a listagem.</p>}
      <div className="actions"><button className="primary" disabled={busy||!options.length}>{busy?"Salvando…":uncertain?"Reenviar registro":editing?"Salvar alteração":"Registrar conferência"}</button>
        {(editing||uncertain)&&<button type="button" disabled={busy} onClick={()=>{if(!uncertain||window.confirm("Confira a listagem antes de criar outro registro. Descartar?"))reset();}}>Descartar formulário</button>}</div>
    </form>}
    {notice&&<p role="status" className="notice">{notice}</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    <section className="panel stack">
      <h2>Histórico de fornecedores</h2>
      <form className="stack" onSubmit={e=>{e.preventDefault();setApplied({...filters});setCursors([0]);setHistory(null);}}>
        <div className="filter-grid">
          <label>Filtrar loja<select aria-label="Filtrar loja" value={filters.store} onChange={e=>setFilters({...filters,store:e.target.value})}><option value="">Todas autorizadas</option>{options.map(s=><option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select></label>
          <label>Pesquisar fornecedor ou referência<input maxLength={100} value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label>
          <label>Filtrar conferente<input maxLength={200} value={filters.checker} onChange={e=>setFilters({...filters,checker:e.target.value})}/></label>
          <label>De<input type="date" value={filters.from_date} onChange={e=>setFilters({...filters,from_date:e.target.value})}/></label>
          <label>Até<input type="date" value={filters.to_date} onChange={e=>setFilters({...filters,to_date:e.target.value})}/></label>
          <label className="checkbox"><input type="checkbox" checked={filters.include_cancelled} onChange={e=>setFilters({...filters,include_cancelled:e.target.checked})}/>Incluir canceladas</label>
        </div>
        <div className="actions"><button>Aplicar filtros</button><button type="button" onClick={()=>{setFilters(emptyFilters);setApplied(emptyFilters);setCursors([0]);setHistory(null);}}>Limpar filtros</button></div>
      </form>
      <div className="actions"><button className="primary" disabled={exporting||list.isPending} onClick={()=>void exportFile()}>{exporting?"Gerando…":"Gerar Excel de fornecedores"}</button>{exporting&&<button onClick={()=>downloadController.current?.abort()}>Cancelar download</button>}</div>
      <QueryState loading={list.isPending} error={list.error} retry={()=>void list.refetch()}/>
      {list.data&&<dl className="metrics"><div><dt>Conferências realizadas no filtro</dt><dd>{list.data.completed}</dd></div>{applied.include_cancelled&&<div><dt>Canceladas</dt><dd>{list.data.cancelled}</dd></div>}</dl>}
      {list.data?.records.length===0&&<p>Nenhuma conferência encontrada.</p>}
      <div className="table-wrap"><table><thead><tr>{["Loja","Fornecedor","Conferente","Data e hora","Referência","Situação","Ações"].map(t=><th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{list.data?.records.map(row=><tr key={row.id}>
        <td>{row.store}</td><td>{row.supplier_code&&row.supplier_code+" · "}{row.supplier_name}</td><td>{row.checker}</td><td>{labelDate(row.checked_at)}</td><td>{row.reference??"—"}{row.notes&&<small>{row.notes}</small>}</td><td>{row.active?"Conferido":"Cancelado"}</td>
        <td><div className="actions"><button onClick={()=>setHistory(row)}>Histórico {row.id}</button>{writable&&row.active&&(identity?.role==="admin"||row.created_by===identity?.subject)&&<button disabled={busy} onClick={()=>startEdit(row)}>Corrigir {row.id}</button>}</div></td>
      </tr>)}</tbody></table></div>
      <div className="actions"><button disabled={cursors.length===1} onClick={()=>setCursors(c=>c.slice(0,-1))}>Anterior</button><button disabled={list.data?.next_cursor==null} onClick={()=>{if(list.data?.next_cursor!=null)setCursors(c=>[...c,list.data!.next_cursor!]);}}>Próxima</button></div>
    </section>
    {history&&<History key={history.id} row={history} onClose={()=>setHistory(null)}/>}
  </>;
}
