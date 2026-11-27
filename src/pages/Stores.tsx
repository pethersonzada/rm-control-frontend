import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "../hooks/workspace";
import { QueryState } from "../components/QueryState";
import type { Store } from "../domain/types";

const empty: Store = {code: "", name: "", active: true};
export default function Stores({ refresh }: {refresh: () => void}) {
  const {remote} = useWorkspace();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Store>(empty);
  const [showForm,setShowForm]=useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const query = useQuery({queryKey: ["stores"], queryFn: ({signal}) => remote!.stores(signal)});
  const save = useMutation({mutationFn: (store: Store) => remote!.saveStore(store), onSuccess: async () => {
    setDraft(empty);
    setEditing(false);setShowForm(false);
    await client.invalidateQueries();
    refresh();
  }});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.active && !window.confirm("Desativar esta loja? Os usuários perderão acesso, mas o histórico será preservado.")) return;
    save.mutate({...draft, name: draft.name.trim()});
  }
  return <>
    <div className="page-heading"><div><h1>Lojas</h1><p className="muted">Gerencie as unidades e seus acessos.</p></div>{!showForm&&<button className="primary" onClick={()=>{setDraft(empty);setEditing(false);save.reset();setShowForm(true);}}>Nova loja</button>}</div>
    {save.isSuccess&&!showForm&&<p role="status" className="notice">Loja salva.</p>}
    {showForm?<form className="panel stack" onSubmit={submit}>
      <h2>{editing ? "Editar loja" : "Cadastrar loja"}</h2>
      <div className="filter-grid">
        <label>Código da loja<input required pattern="[0-9]{1,12}" inputMode="numeric" readOnly={editing} value={draft.code} onChange={e => setDraft({...draft, code:e.target.value})}/></label>
        <label>Nome da loja<input required maxLength={200} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      </div>
      <label className="checkbox"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Loja ativa</label>
      <div className="actions">
        <button className="primary" disabled={save.isPending}>Salvar loja</button>
        <button type="button" disabled={save.isPending} onClick={()=>{setDraft(empty);setEditing(false);save.reset();setShowForm(false);}}>Cancelar</button>
      </div>
      {save.error && <p role="alert" className="error">{save.error.message}</p>}
      {save.isSuccess && <p role="status" className="notice">Loja salva.</p>}
    </form>:<section className="panel stack">
      <h2>Lojas cadastradas</h2>
      <label>Pesquisar loja<input value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <QueryState loading={query.isPending} error={query.error} retry={()=>void query.refetch()}/>
      <div className="table-wrap">
        <table><thead><tr><th scope="col">Código</th><th scope="col">Nome</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
        <tbody>{query.data?.filter(s=>(s.code+" "+s.name).toLowerCase().includes(search.toLowerCase())).map(s=><tr key={s.code}><td>{s.code}</td><td>{s.name}</td><td>{s.active?"Ativa":"Desativada"}</td><td><button onClick={()=>{setDraft(s);setEditing(true);save.reset();setShowForm(true);}}>Editar</button></td></tr>)}</tbody></table>
      </div>
    </section>}
  </>;
}
