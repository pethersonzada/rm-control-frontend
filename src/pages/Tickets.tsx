import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/workspace";
import type { Item, Occurrence, TicketInput } from "../domain/types";
import { QueryState } from "../components/QueryState";
import { ApiError } from "../services/api";

const emptyItem = (): Item => ({code:"", description:"", package:"", quantity:"", total:null, unit_value:null, category:null});
function isoDay(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10).split("/").reverse().join("-");
}
function decimal(value: string | null | undefined): string | null {
  if (value == null || !value.trim()) return null;
  const text = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d{1,8})?$/.test(text)) throw new Error("Use números decimais sem separador de milhares.");
  return text.replace(",", ".");
}
export function TicketForm({record, onCancel}: {record?: Occurrence; onCancel: () => void}) {
  const {remote, identity} = useWorkspace();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TicketInput>(() => ({
    destination: record?.destination ?? identity?.stores[0] ?? "",
    origin:record?.origin ?? "", load:record?.load ?? "", bdv:record?.bdv ?? null,
    external_code:record?.external_code ?? null, reason:record?.reason ?? "",
    received_at:isoDay(record?.received_at), items:record?.items.length ? record.items : [emptyItem()],
    invoices:record?.invoices ?? [],
  }));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [created,setCreated] = useState<Occurrence | null>(null);
  const [catalogNotice,setCatalogNotice] = useState("");
  const [lookingUp,setLookingUp] = useState(false);
  const pending = useRef(false);
  const key = useRef(crypto.randomUUID());
  const sentPayload = useRef<string | null>(null);
  const stores = useQuery({queryKey:["stores"],queryFn:({signal})=>remote!.stores(signal)});
  const options = stores.data?.filter(s=>s.active) ?? [];
  function set<K extends keyof TicketInput>(field:K,value:TicketInput[K]) {setDraft(d=>({...d,[field]:value}));}
  function item(index:number,patch:Partial<Item>) {setDraft(d=>({...d,items:d.items.map((i,n)=>n===index?{...i,...patch}:i)}));}
  async function lookup(index:number) {
    if (!remote || lookingUp) return;
    const code=draft.items[index]?.code;
    if(!code || !/^\d{1,40}$/.test(code)) {setCatalogNotice("Informe um PLU válido.");return;}
    setLookingUp(true);setCatalogNotice("");
    try {
      const found=(await remote.catalog("",0,code)).products.find(p=>p.code===code&&p.active);
      if(!found){setCatalogNotice("PLU não encontrado no catálogo ativo. Preencha os campos manualmente.");return;}
      setDraft(d=>({...d,items:d.items.map((i,n)=>n===index&&i.code===code?{...i,description:i.description||found.description,category:i.category||found.category,package:i.package||found.package||""}:i)}));
      setCatalogNotice("Campos vazios preenchidos pelo catálogo. Confira antes de salvar.");
    }catch(caught){setCatalogNotice((caught as Error).message);}
    finally{setLookingUp(false);}
  }
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || !remote) return;
    setError("");
    pending.current=true;
    setBusy(true);
    try {
      const payload:TicketInput = {...draft, origin:draft.origin.trim(), load:draft.load.trim(),
        bdv:draft.bdv?.trim()||null, external_code:draft.external_code?.trim()||null,
        reason:draft.reason.trim(),
        items:draft.items.map(i=>({...i,description:i.description.trim(),package:i.package.trim(),
          quantity:decimal(i.quantity) ?? "",total:decimal(i.total),unit_value:decimal(i.unit_value),category:i.category?.trim()||null})),
        invoices:draft.invoices.map(i=>({number:i.number.trim(),series:i.series.trim()}))};
      const serialized = JSON.stringify(payload);
      if (!record && sentPayload.current && sentPayload.current !== serialized)
        throw new Error("A tentativa anterior pode ter sido gravada. Confira a listagem antes de abrir outro chamado; para reenviar, mantenha os mesmos dados.");
      sentPayload.current = serialized;
      const response = record && record.revision ? await remote.editTicket(record.code,payload,record.revision) : await remote.createTicket(payload,key.current);
      setCreated(response);
      await client.invalidateQueries();
    } catch (caught) {
      if (!record && caught instanceof ApiError && [400, 401, 403, 413, 422, 429].includes(caught.status)) sentPayload.current = null;
      setError((caught as Error).message);
    } finally {pending.current=false;setBusy(false);}
  }
  if (created) return <section className="panel stack">
    <h1>{record?"Chamado atualizado":"Chamado registrado"}</h1>
    <p role="status" className="notice">Dados salvos no banco. A próxima geração de planilha já incluirá este registro.</p>
    <p>Identificador RM: <code className="user-uid">{created.code}</code></p>
    {created.external_code && <p>Número externo: {created.external_code}</p>}
    <button className="primary" onClick={()=>{onCancel();navigate("/chamados");}}>Voltar aos chamados</button>
  </section>;
  return <>
    <div className="page-heading"><h1>{record?"Editar chamado":"Novo chamado"}</h1><button onClick={onCancel} disabled={busy}>Voltar</button></div>
    <p className="muted">Registre a ocorrência no RM Control. O chamado oficial em outro sistema deve ser tratado separadamente.</p>
    <form className="stack" onSubmit={submit}>
      <section className="panel stack">
        <h2><span className="step-number">1</span> Dados da ocorrência</h2>
        <QueryState loading={stores.isPending} error={stores.error} retry={()=>void stores.refetch()}/>
        <fieldset disabled={busy} className="filter-grid">
          <label>Loja<select aria-label="Loja" value={draft.destination} onChange={e=>set("destination",e.target.value)} required disabled={Boolean(record)}><option value="">Selecione</option>{options.map(s=><option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}{record && !options.some(s=>s.code===record.destination)&&<option value={record.destination}>{record.destination}</option>}</select></label>
          <label>Data de recebimento<input required type="date" value={draft.received_at} onChange={e=>set("received_at",e.target.value)}/></label>
          <label>Tipo de divergência<select aria-label="Tipo de divergência" required value={draft.reason} onChange={e=>set("reason",e.target.value)}><option value="">Selecione</option>{[...new Set(["FALTA","SOBRA","AVARIA",...(draft.reason?[draft.reason]:[])])].map(r=><option key={r}>{r}</option>)}</select></label>
          <label>CD de origem<input maxLength={200} value={draft.origin} onChange={e=>set("origin",e.target.value)}/></label>
          <label>BDV<input maxLength={40} value={draft.bdv??""} onChange={e=>set("bdv",e.target.value)}/></label>
          <label>Carga<input maxLength={80} value={draft.load} onChange={e=>set("load",e.target.value)}/></label>
          <label>Nº chamado externo (opcional)<input inputMode="numeric" pattern="[0-9]{1,40}" value={draft.external_code??""} onChange={e=>set("external_code",e.target.value)}/></label>
        </fieldset>
      </section>
      <section className="panel stack">
        <h2><span className="step-number">2</span> Produtos e divergências</h2>
        {catalogNotice && <p role="status" className="notice">{catalogNotice}</p>}
        {draft.items.map((i,n)=><fieldset key={n} className="product-form stack" disabled={busy}>
          <legend>Produto {n+1}</legend>
          <div className="actions"><button type="button" disabled={busy||lookingUp||!i.code} onClick={()=>void lookup(n)}>{lookingUp?"Consultando…":"Buscar PLU no catálogo"}</button></div>
          <div className="filter-grid">
            <label>PLU<input required inputMode="numeric" pattern="[0-9]{1,40}" value={i.code} onChange={e=>item(n,{code:e.target.value})}/></label>
            <label>Descrição<input required maxLength={500} value={i.description} onChange={e=>item(n,{description:e.target.value})}/></label>
            <label>Categoria<input maxLength={200} value={i.category??""} onChange={e=>item(n,{category:e.target.value})}/></label>
            <label>Embalagem / volume<input required maxLength={80} value={i.package} onChange={e=>item(n,{package:e.target.value})}/></label>
            <label>Quantidade divergente<input required inputMode="decimal" value={i.quantity} onChange={e=>item(n,{quantity:e.target.value})}/></label>
            <label>Valor total informado (R$)<input inputMode="decimal" value={i.total??""} onChange={e=>item(n,{total:e.target.value})}/></label>
            <label>Valor unitário (opcional)<input inputMode="decimal" value={i.unit_value??""} onChange={e=>item(n,{unit_value:e.target.value})}/></label>
          </div>
          {draft.items.length>1&&<button type="button" onClick={()=>set("items",draft.items.filter((_,x)=>x!==n))}>Remover produto {n+1}</button>}
        </fieldset>)}
        <button type="button" disabled={busy||draft.items.length>=500} onClick={()=>set("items",[...draft.items,emptyItem()])}>Adicionar produto</button>
      </section>
      <section className="panel stack">
        <h2><span className="step-number">3</span> Notas fiscais <small className="inline-note">Opcional</small></h2>
        {draft.invoices.map((i,n)=><fieldset key={n} disabled={busy} className="filter-grid">
          <label>Número NF {n+1}<input required inputMode="numeric" pattern="[0-9]{1,20}" value={i.number} onChange={e=>set("invoices",draft.invoices.map((v,x)=>x===n?{...v,number:e.target.value}:v))}/></label>
          <label>Série NF {n+1}<input required inputMode="numeric" pattern="[0-9]{1,10}" value={i.series} onChange={e=>set("invoices",draft.invoices.map((v,x)=>x===n?{...v,series:e.target.value}:v))}/></label>
          <button type="button" onClick={()=>set("invoices",draft.invoices.filter((_,x)=>x!==n))}>Remover nota {n+1}</button>
        </fieldset>)}
        <button type="button" disabled={busy||draft.invoices.length>=100} onClick={()=>set("invoices",[...draft.invoices,{number:"",series:""}])}>Adicionar nota fiscal</button>
      </section>
      {error&&<p role="alert" className="error">{error}</p>}
      <div className="actions form-footer"><button className="primary" disabled={busy||stores.isPending||(!record&&!options.length)}>{busy?"Salvando…":record?"Salvar alterações":"Salvar chamado"}</button><button type="button" onClick={onCancel} disabled={busy}>Cancelar</button></div>
    </form>
  </>;
}
export default function NewTicket() {
  const navigate=useNavigate();
  return <TicketForm onCancel={()=>navigate("/chamados")}/>;
}
