import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useWorkspace} from "../hooks/workspace";
import {QueryState} from "./QueryState";
export function Diagnostics(){
  const {remote}=useWorkspace();
  const [opened,setOpened]=useState(false);
  const q=useQuery({queryKey:["diagnostics"],queryFn:({signal})=>remote!.diagnostics(signal),enabled:opened,retry:false});
  return <section className="panel stack">
    <h2>Diagnóstico do servidor</h2>
    <p className="muted">Métricas desde a inicialização do processo. Reinícios e suspensão do Render zeram os contadores. Não representa monitoramento histórico.</p>
    <button onClick={()=>{if(opened)void q.refetch();else setOpened(true);}}>Consultar diagnóstico</button>
    {opened&&<><QueryState loading={q.isPending} error={q.error} retry={()=>void q.refetch()}/>{q.data&&<dl className="metrics">{[
      ["Tempo ativo (s)",q.data.uptime_seconds],["Requisições",q.data.requests],["Erros do servidor",q.data.server_errors],["Erros do cliente",q.data.client_errors],["Limites atingidos",q.data.rate_limited],["Requisições lentas",q.data.slow_requests],["Tempo médio (ms)",q.data.mean_duration_ms]
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</>}
  </section>;
}
