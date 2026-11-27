import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryState } from "../components/QueryState";
import type { Member } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";

const labels = {
  viewer: "Visualizador",
  importer: "Operador",
  admin: "Administrador",
};
const empty: Member = { uid: "", role: "viewer", stores: [], active: true };

export default function Users() {
  const { remote, identity } = useWorkspace();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Member>(empty);
  const [selected, setSelected] = useState(false);
  const members = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => remote!.users(signal),
    enabled: Boolean(remote),
  });
  const stores = useQuery({queryKey:["stores"], queryFn:({signal})=>remote!.stores(signal), enabled: Boolean(remote)});
  const requests = useQuery({queryKey:["access-requests"], queryFn:({signal})=>remote!.accessRequests(signal), enabled: Boolean(remote && identity?.can_delegate_admin)});
  const reject = useMutation({mutationFn:(uid:string)=>remote!.rejectAccess(uid), onSuccess:()=>client.invalidateQueries({queryKey:["access-requests"]})});
  const save = useMutation({
    mutationFn: (member: Member) => remote!.saveUser(member),
    onSuccess: async () => {
      setDraft(empty);
      setSelected(false);
      await client.invalidateQueries({ queryKey: ["users"] });
      await client.invalidateQueries({ queryKey: ["access-requests"] });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.stores.length) save.mutate({ ...draft, uid: draft.uid.trim() });
  }
  return (
    <>
      <h1>Usuários</h1>
      {identity?.can_delegate_admin && <section className="panel stack"><h2>Solicitações de acesso</h2><QueryState loading={requests.isPending} error={requests.error} retry={()=>void requests.refetch()}/>{requests.data?.length===0&&<p>Nenhuma solicitação pendente.</p>}{requests.data?.map(r=><div key={r.uid} className="panel stack"><code className="user-uid">{r.uid}</code><div className="actions"><button onClick={()=>{save.reset();setDraft({...empty,uid:r.uid});setSelected(false);}}>Definir permissões</button><button disabled={reject.isPending} onClick={()=>{if(window.confirm("Rejeitar esta solicitação?")) reject.mutate(r.uid);}}>Rejeitar</button></div></div>)}{reject.error&&<p role="alert" className="error">{reject.error.message}</p>}</section>}
      <section className="panel stack">
        <h2>Vínculos da organização</h2>
        <QueryState
          loading={members.isPending}
          error={members.error}
          retry={() => void members.refetch()}
        />
        {members.data && (
          <ul className="stack">
            {members.data.map((member) => (
              <li key={member.uid}>
                <code className="user-uid">{member.uid}</code> ·{" "}
                {labels[member.role]} · {member.stores.join(", ")} ·{" "}
                {member.active ? "Ativo" : "Desativado"}
                {!member.owner &&
                  (member.role !== "admin" || identity?.can_delegate_admin) && (
                    <button
                      disabled={save.isPending}
                      onClick={() => {
                        save.reset();
                        setDraft({...member,stores:member.stores.filter(code=>!stores.data?.some(s=>s.code===code&&!s.active))});
                        setSelected(true);
                      }}
                    >
                      Editar
                    </button>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="panel stack" onSubmit={submit}>
        <h2>{selected ? "Editar vínculo" : "Autorizar usuário por UID"}</h2>
        <label htmlFor="member-uid">UID no Firebase</label>
        <input
          id="member-uid"
          value={draft.uid}
          required
          maxLength={128}
          readOnly={selected}
          onChange={(event) => setDraft({ ...draft, uid: event.target.value })}
        />
        <label htmlFor="member-role">Perfil</label>
        <select
          id="member-role"
          value={draft.role}
          onChange={(event) =>
            setDraft({ ...draft, role: event.target.value as Member["role"] })
          }
        >
          {Object.entries(labels)
            .filter(
              ([role]) => role !== "admin" || identity?.can_delegate_admin,
            )
            .map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
        </select>
        <fieldset>
          <legend>Lojas autorizadas</legend>
          {(stores.data?.filter(s=>s.active) ?? (identity?.stores??[]).map(code=>({code,name:"Loja "+code,active:true}))).map(({code:store,name}) => (
            <label className="checkbox" key={store}>
              <input
                type="checkbox"
                checked={draft.stores.includes(store)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    stores: event.target.checked
                      ? [...draft.stores, store]
                      : draft.stores.filter((value) => value !== store),
                  })
                }
              />{" "}
              {store} · {name}
            </label>
          ))}
        </fieldset>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) =>
              setDraft({ ...draft, active: event.target.checked })
            }
          />{" "}
          Acesso ativo
        </label>
        <div className="actions">
          <button
            className="primary"
            disabled={save.isPending || !draft.stores.length}
          >
            Salvar permissões
          </button>
          {selected && (
            <button
              type="button"
              onClick={() => {
                setDraft(empty);
                setSelected(false);
                save.reset();
              }}
            >
              Cancelar
            </button>
          )}
        </div>
        {save.isSuccess && (
          <p role="status" className="notice">
            Permissões atualizadas.
          </p>
        )}
        {save.error && (
          <p role="alert" className="error">
            {save.error.message}
          </p>
        )}
      </form>
    </>
  );
}
