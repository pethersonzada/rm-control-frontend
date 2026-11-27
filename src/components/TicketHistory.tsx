import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Occurrence } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";
import { QueryState } from "./QueryState";

const actions: Record<string,string> = {"ticket.create":"Chamado criado","ticket.edit":"Chamado editado",import:"Importação",status:"Status alterado"};
const fields: Record<string,string> = {creation:"Abertura",destination:"Loja",origin:"Origem",load:"Carga",bdv:"BDV",reason:"Motivo",received_at:"Recebimento",external_code:"Número externo",items:"Produtos",invoices:"Notas fiscais"};
export function TicketHistory({record}: {record: Occurrence}) {
  const {remote, identity} = useWorkspace();
  const [cursors,setCursors] = useState([0]);
  const cursor = cursors.at(-1) ?? 0;
  const query = useQuery({queryKey:["ticket-history",identity?.subject,record.destination,record.code,cursor],
    queryFn:({signal})=>remote!.history(record,cursor,signal),enabled:Boolean(remote)});
  return <section className="stack ticket-history" aria-label="Histórico do chamado">
    <h2>Histórico do chamado</h2>
    <QueryState loading={query.isPending} error={query.error} retry={()=>void query.refetch()}/>
    {query.data?.events.length===0 && <p>Nenhuma alteração registrada.</p>}
    <ol className="stack">{query.data?.events.map((event,index)=><li key={index}>
      <strong>{actions[event.action]??event.action}</strong>
      <small>{new Date(event.created_at.endsWith("Z")||/[+-]\d\d:\d\d$/.test(event.created_at)?event.created_at:event.created_at+"Z").toLocaleString("pt-BR")} · {event.subject===identity?.subject?"Você":event.subject}</small>
      {event.previous_status!==event.next_status&&<p>{event.previous_status??"Sem status"} → {event.next_status??"Sem status"}</p>}
      {event.details?.fields?.length ? <p>Campos: {event.details.fields.map(field=>fields[field]??field).join(", ")}</p>:null}
      {event.details?.revision && <small>Revisão {event.details.revision}</small>}
    </li>)}</ol>
    <div className="actions">
      <button disabled={cursors.length===1} onClick={()=>setCursors(c=>c.slice(0,-1))}>Mais recentes</button>
      <button disabled={query.data?.next_cursor==null} onClick={()=>{if(query.data?.next_cursor!=null)setCursors(c=>[...c,query.data!.next_cursor!]);}}>Mais antigos</button>
    </div>
  </section>;
}
