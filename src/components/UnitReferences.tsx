import {useState,type FormEvent} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "./QueryState";
import type {UnitReference} from "../domain/types";

function blank(code:string):UnitReference{return {code,package:"",base_unit:"",factor:"",reference:"",active:true,revision:0};}
export function UnitReferences(){
  const {remote}=useWorkspace();
  const client=useQueryClient();
  const [code,setCode]=useState("");
  const [selected,setSelected]=useState("");
  const [draft,setDraft]=useState<UnitReference>(blank(""));
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const q=useQuery({queryKey:["unit-references",selected],queryFn:({signal})=>remote!.units(selected,signal),enabled:!!selected});
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!remote)return;setBusy(true);setError("");setNotice("");
    try{
      if(!/^\d+(?:[.,]\d{1,8})?$/.test(draft.factor.trim()))throw new Error("Informe um fator decimal positivo, sem separador de milhar.");
      const value=await remote.saveUnit({...draft,factor:draft.factor.trim().replace(",","."),package:draft.package.trim(),base_unit:draft.base_unit.trim(),reference:draft.reference.trim()});
      setDraft(value);setNotice("Referência registrada.");await client.invalidateQueries({queryKey:["unit-references",selected]});
    }catch(caught){setError((caught as Error).message);}
    finally{setBusy(false);}
  }
  return <section className="panel stack">
    <h2>Referências de embalagens</h2>
    <p>Cadastre somente fatores conferidos para produtos ativos no catálogo. O resultado é informativo e não ajusta o estoque.</p>
    <form className="inline-form" onSubmit={e=>{e.preventDefault();setSelected(code);setDraft(blank(code));setNotice("");setError("");}}>
      <label>PLU da referência<input required pattern="[0-9]{1,40}" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)}/></label>
      <button disabled={busy}>Consultar referências</button>
    </form>
    {selected&&<><QueryState loading={q.isPending} error={q.error} retry={()=>void q.refetch()}/>
      <div className="table-wrap"><table><thead><tr>{["Embalagem","Unidade base","Fator","Fonte","Situação","Ação"].map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{q.data?.map(row=><tr key={row.package}><td>{row.package}</td><td>{row.base_unit}</td><td>{row.factor}</td><td>{row.reference}</td><td>{row.active?"Ativa":"Inativa"}</td><td><button disabled={busy} onClick={()=>{setDraft(row);setNotice("");setError("");}}>Editar {row.package}</button></td></tr>)}</tbody></table></div>
      <button disabled={busy} onClick={()=>{setDraft(blank(selected));setError("");setNotice("");}}>Nova referência</button>
      <form className="stack" onSubmit={save}>
        <fieldset disabled={busy} className="filter-grid">
          <label>Embalagem<input required maxLength={80} readOnly={draft.revision>0} value={draft.package} onChange={e=>setDraft({...draft,package:e.target.value})}/></label>
          <label>Unidade base<input required maxLength={80} value={draft.base_unit} onChange={e=>setDraft({...draft,base_unit:e.target.value})}/></label>
          <label>Fator por embalagem<input required inputMode="decimal" value={draft.factor} onChange={e=>setDraft({...draft,factor:e.target.value})}/></label>
          <label>Fonte conferida<input required maxLength={500} value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label>
          <label className="checkbox"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Referência ativa</label>
        </fieldset>
        <button className="primary" disabled={busy}>Salvar referência</button>
      </form>
    </>}
    {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  </section>;
}
