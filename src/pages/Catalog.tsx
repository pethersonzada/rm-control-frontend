import {useDeferredValue,useState,type FormEvent} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import type {CatalogProduct} from "../domain/types";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "../components/QueryState";

const empty:CatalogProduct={code:"",description:"",category:null,package:null,reference:"",active:true};

export default function Catalog(){
  const {remote}=useWorkspace();
  const client=useQueryClient();
  const [draft,setDraft]=useState<CatalogProduct>(empty);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState(false);
  const [search,setSearch]=useState("");
  const deferred=useDeferredValue(search);
  const [cursors,setCursors]=useState([0]);
  const cursor=cursors.at(-1)??0;
  const query=useQuery({queryKey:["catalog",deferred,cursor],queryFn:({signal})=>remote!.catalog(deferred,cursor,undefined,signal)});
  const save=useMutation({mutationFn:(data:CatalogProduct)=>remote!.saveProduct(data),onSuccess:async()=>{setDraft(empty);setEditing(false);setShowForm(false);await client.invalidateQueries({queryKey:["catalog"]});}});
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    save.mutate({...draft,description:draft.description.trim(),reference:draft.reference.trim(),category:draft.category?.trim()||null,package:draft.package?.trim()||null});
  }
  return <>
    <div className="page-heading"><div><h1>Catálogo de produtos</h1><p className="muted">Consulte produtos por PLU e descrição.</p></div>{!showForm&&<button className="primary" onClick={()=>{setDraft(empty);setEditing(false);save.reset();setShowForm(true);}}>Novo produto</button>}</div>
    {save.isSuccess&&!showForm&&<p role="status" className="notice">Produto salvo.</p>}
    {showForm?<form className="panel stack" onSubmit={submit}>
      <h2>{editing?"Editar produto":"Cadastrar produto"}</h2><p className="muted">Use referências conferidas. O catálogo sugere descrição, categoria e embalagem; não calcula valores.</p>
      <fieldset disabled={save.isPending} className="filter-grid">
        <label>PLU<input required readOnly={editing} inputMode="numeric" pattern="[0-9]{1,40}" value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/></label>
        <label>Descrição<input required maxLength={500} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <label>Categoria<input maxLength={200} value={draft.category??""} onChange={e=>setDraft({...draft,category:e.target.value})}/></label>
        <label>Embalagem<input maxLength={80} value={draft.package??""} onChange={e=>setDraft({...draft,package:e.target.value})}/></label>
        <label>Referência conferida<input required maxLength={200} value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label>
        <label className="checkbox"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Produto ativo</label>
      </fieldset>
      <div className="actions"><button className="primary" disabled={save.isPending}>Salvar produto</button><button type="button" disabled={save.isPending} onClick={()=>{setDraft(empty);setEditing(false);save.reset();setShowForm(false);}}>Cancelar</button></div>
      {save.error&&<p role="alert" className="error">{save.error.message}</p>}
      {save.isSuccess&&<p role="status" className="notice">Produto salvo.</p>}
    </form>:<section className="panel stack">
      <h2>Produtos cadastrados</h2>
      <label>Pesquisar por PLU ou descrição<input maxLength={100} value={search} onChange={e=>{setSearch(e.target.value);setCursors([0]);}}/></label>
      <QueryState loading={query.isPending} error={query.error} retry={()=>void query.refetch()}/>
      {query.data?.products.length===0&&<p>Nenhum produto cadastrado.</p>}
      <div className="table-wrap"><table><thead><tr><th scope="col">PLU</th><th scope="col">Descrição</th><th scope="col">Categoria</th><th scope="col">Embalagem</th><th scope="col">Referência</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead><tbody>{query.data?.products.map(p=><tr key={p.code}><td>{p.code}</td><td>{p.description}</td><td>{p.category??"—"}</td><td>{p.package??"—"}</td><td>{p.reference}</td><td>{p.active?"Ativo":"Inativo"}</td><td><button onClick={()=>{setDraft(p);setEditing(true);save.reset();setShowForm(true);}}>Editar</button></td></tr>)}</tbody></table></div>
      <div className="actions"><button disabled={cursors.length===1} onClick={()=>setCursors(c=>c.slice(0,-1))}>Anterior</button><button disabled={query.data?.next_cursor==null} onClick={()=>{if(query.data?.next_cursor!=null)setCursors(c=>[...c,query.data!.next_cursor!]);}}>Próxima</button></div>
    </section>}
  </>;
}
