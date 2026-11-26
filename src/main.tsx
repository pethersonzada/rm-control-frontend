import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type Item={code:string;description:string;quantity:string;package:string;total:string|null};
type RecordData={code:string;origin:string;destination:string;load:string;reason:string;included_at:string|null;status:string;items:Item[]};
type Preview={records:RecordData[];warnings:string[]};
const API=import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const sample='90001\t001-CD EXEMPLO\t002-LOJA EXEMPLO\t100001\tManual\nFALTA\t01/01/2026 10:00:00\noperador\nEXEMPLO\tCARRETA\tEXEMPLO\tAGU. ANALISE\nCÓDIGO\nPRODUTO\n100\tPRODUTO FICTÍCIO\t2\tCX-12';
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(API+path,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok) throw new Error('A API retornou o código '+response.status+'. Confira os dados e tente novamente.');
 return response.json() as Promise<T>;
}
function App(){
 const [page,setPage]=useState<'overview'|'import'|'records'>('overview');
 const [records,setRecords]=useState<RecordData[]>([]);
 const [raw,setRaw]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null);
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('');
 const [reason,setReason]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [connected,setConnected]=useState(false);
 const [open,setOpen]=useState<string|null>(null);
 async function refresh(){
  try {setRecords(await request<RecordData[]>('/occurrences'));setConnected(true);}
  catch {setConnected(false);setError('Não foi possível conectar à API local. Inicie o backend.');}
 }
 useEffect(()=>{void refresh()},[]);
 async function analyze(){
  setBusy(true);setError('');setNotice('');setPreview(null);
  try {setPreview(await request<Preview>('/imports/preview',{text:raw}));}
  catch(e){setError((e as Error).message)} finally{setBusy(false)}
 }
 async function save(){
  if(!preview)return;
  setBusy(true);setError('');setNotice('');
  try {const result=await request<{saved:number}>('/imports/confirm',preview.records);
   setNotice(result.saved+' chamado(s) salvo(s).');setPreview(null);setRaw('');await refresh();setPage('records');
  } catch(e){setError((e as Error).message)} finally{setBusy(false)}
 }
 const filtered=records.filter(r=>(!status||r.status===status)&&(!reason||r.reason===reason)&&[r.code,r.load,r.origin,r.destination,r.reason,...r.items.flatMap(i=>[i.code,i.description])].join(' ').toLowerCase().includes(query.toLowerCase()));
 const counts=Object.entries(records.reduce<Record<string,number>>((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{}));
 function table(data:RecordData[]){return <div className="table-wrap"><table><thead><tr><th>Ocorrência</th><th>Carga</th><th>Motivo</th><th>Inclusão</th><th>Status</th><th>Itens</th></tr></thead><tbody>{data.map(r=><React.Fragment key={r.code}><tr><td><button className="link" onClick={()=>setOpen(open===r.code?null:r.code)}>{r.code} {open===r.code?'−':'+'}</button></td><td>{r.load}</td><td>{r.reason||'Não informado'}</td><td>{r.included_at||'—'}</td><td><span className="tag">{r.status}</span></td><td>{r.items.length||'—'}</td></tr>{open===r.code&&<tr><td colSpan={6}><div className="details"><strong>{r.origin} / {r.destination}</strong>{r.items.length?r.items.map((i,index)=><div className="item" key={index}><span>{i.code} · {i.description}</span><span>{i.quantity} {i.package}</span></div>):<p>Nenhum item visível.</p>}</div></td></tr>}</React.Fragment>)}{!data.length&&<tr><td colSpan={6} className="empty">Nenhum chamado encontrado.</td></tr>}</tbody></table></div>}
 return <div className="layout"><aside><div className="brand"><span className="logo">RM</span><div><b>RM Control</b><small>Operações logísticas</small></div></div><p className="nav-label">GERENCIAMENTO</p>{([['overview','Visão geral'],['records','Chamados'],['import','Importar dados']] as const).map(([key,label])=><button key={key} className={'nav '+(page===key?'active':'')} onClick={()=>setPage(key)}>{label}</button>)}<footer>Versão 0.1 · Desenvolvimento<br/>Uso local autorizado</footer></aside><main><header><div><small>Workspace / Operações</small><h1>{page==='overview'?'Visão geral':page==='records'?'Chamados':'Importar dados'}</h1></div><span className={'connection '+(connected?'on':'')}>{connected?'API conectada':'API desconectada'}</span></header>{error&&<div role="alert" className="alert">{error} <button className="link" onClick={()=>{setError('');void refresh()}}>Reconectar</button></div>}{notice&&<div role="status" className="notice">{notice}</div>}
 {page==='overview'&&<><div className="intro"><div><h2>Acompanhamento operacional</h2><p>Consulte ocorrências e importe registros em um único lugar.</p></div><button className="primary" onClick={()=>setPage('import')}>+ Nova importação</button></div><div className="metrics">{[['Chamados',records.length],['Itens cadastrados',records.reduce((a,r)=>a+r.items.length,0)],['Aguardando análise',records.filter(r=>r.status==='AGU. ANALISE').length],['Sem itens visíveis',records.filter(r=>!r.items.length).length]].map(([label,value])=><section className="panel metric" key={label}><small>{label}</small><strong>{value}</strong></section>)}</div><section className="panel"><h2>Situação dos chamados</h2>{counts.length?counts.map(([label,count])=><div className="barrow" key={label}><span>{label}</span><div className="track"><div style={{width:(count/records.length*100)+'%'}}/></div><b>{count}</b></div>):<p className="muted">Importe dados para visualizar os indicadores.</p>}</section><section className="panel"><h2>Chamados cadastrados</h2>{table(records.slice(0,8))}</section></>}
 {page==='records'&&<section className="panel"><div className="filters"><input aria-label="Pesquisar" placeholder="Buscar chamado, carga ou PLU" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option>{[...new Set(records.map(r=>r.status))].map(s=><option key={s}>{s}</option>)}</select><select aria-label="Motivo" value={reason} onChange={e=>setReason(e.target.value)}><option value="">Todos os motivos</option>{[...new Set(records.map(r=>r.reason).filter(Boolean))].map(s=><option key={s}>{s}</option>)}</select></div><p className="muted">{filtered.length} registros</p>{table(filtered)}</section>}
 {page==='import'&&<><section className="panel"><h2>Importação de ocorrências</h2><p>Copie a listagem de chamados e cole abaixo. Expanda as linhas de produtos antes de copiar. Use apenas dados autorizados.</p><label htmlFor="paste">Conteúdo copiado</label><textarea id="paste" value={raw} onChange={e=>{setRaw(e.target.value);setPreview(null)}} placeholder="Cole os registros aqui..." rows={10}/><div className="actions"><button className="secondary" onClick={()=>{setRaw(sample);setPreview(null)}} disabled={busy}>Usar exemplo fictício</button><button className="primary" disabled={busy||!raw.trim()} onClick={()=>void analyze()}>{busy?'Processando…':'Analisar dados'}</button></div></section>{preview&&<section className="panel"><h2>Conferência da importação</h2><p>{preview.records.length} chamados reconhecidos. Revise os avisos antes de salvar.</p>{preview.warnings.map((w,i)=><div className="alert" key={i}>{w}</div>)}{table(preview.records)}<div className="actions"><button className="primary" disabled={busy||!preview.records.length} onClick={()=>void save()}>Confirmar importação</button></div></section>}</>}
 </main></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
