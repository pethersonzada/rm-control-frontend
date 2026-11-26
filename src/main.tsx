import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type Item={code:string;description:string;quantity:string;package:string;total:string|null;unit_value?:string|null;category?:string|null};
type RecordData={code:string;origin:string;destination:string;load:string;reason:string;included_at:string|null;status:string;items:Item[];bdv?:string|null;received_at?:string|null;returned_at?:string|null;approved_at?:string|null;is_test?:boolean|null;invoices?:{number:string;series:string}[]};
type Preview={records:RecordData[];warnings:string[];blocked?:boolean};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
let accessToken='';
const API=import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const sample='90001\t001-CD EXEMPLO\t002-LOJA EXEMPLO\t100001\tManual\nFALTA\t01/01/2026 10:00:00\noperador\nEXEMPLO\tCARRETA\tEXEMPLO\tAGU. ANALISE\nCÓDIGO\nPRODUTO\n100\tPRODUTO FICTÍCIO\t2\tCX-12';
async function request<T>(path:string,body?:unknown):Promise<T>{
 const headers:Record<string,string>={'Content-Type':'application/json'}; if(accessToken)headers['X-RM-Token']=accessToken;
 const response=await fetch(API+path,{headers,...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});
 if(!response.ok){const payload=await response.json().catch(()=>null);throw new Error(typeof payload?.detail==='string'?payload.detail:'A API retornou o código '+response.status+'. Confira os dados e tente novamente.');}
 return response.json() as Promise<T>;
}
function App(){
 const [page,setPage]=useState<'overview'|'import'|'records'>('overview');
 const [records,setRecords]=useState<RecordData[]>([]);
 const [raw,setRaw]=useState('');
 const [target,setTarget]=useState('');
 const [upload,setUpload]=useState<File|null>(null);
 const [token,setToken]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [includeTests,setIncludeTests]=useState(false);
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
  try {
    if(upload){
      if(upload.size>17_000_000)throw new Error('Limite de 17 MB para o XLSX.');
      const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(upload)});
      setPreview(await request<Preview>('/imports/spreadsheet',{content_base64:content}));
    }else setPreview(await request<Preview>('/imports/preview',{text:raw,target_code:target.trim()||null}));
  }
  catch(e){setError((e as Error).message)} finally{setBusy(false)}
 }
 async function save(){
  if(!preview||preview.blocked)return;
  setBusy(true);setError('');setNotice('');
  try {const result=await request<{saved:number}>('/imports/confirm',preview.records);
   setNotice(result.saved+' chamado(s) salvo(s).');setPreview(null);setRaw('');setUpload(null);await refresh();setPage('records');
  } catch(e){setError((e as Error).message)} finally{setBusy(false)}
 }
 const dateKey=(r:RecordData)=>{const s=r.received_at||r.included_at||'';const [d,m,y]=s.split(' ')[0].split('/');return y&&m&&d?y+'-'+m+'-'+d:''};
 const scoped=records.filter(r=>(includeTests||!r.is_test)&&(!from||dateKey(r)>=from)&&(!to||!!dateKey(r)&&dateKey(r)<=to));
 const filtered=scoped.filter(r=>(!status||r.status===status)&&(!reason||r.reason===reason)&&[r.code,r.load,r.origin,r.destination,r.reason,...r.items.flatMap(i=>[i.code,i.description])].join(' ').toLowerCase().includes(query.toLowerCase()));
 const counts=Object.entries(scoped.reduce<Record<string,number>>((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{}));
 function table(data:RecordData[]){return <div className="table-wrap"><table><thead><tr><th>Ocorrência</th><th>Carga</th><th>Motivo</th><th>Inclusão</th><th>Status</th><th>Itens</th></tr></thead><tbody>{data.map(r=><React.Fragment key={r.code}><tr><td><button className="link" onClick={()=>setOpen(open===r.code?null:r.code)}>{r.code} {open===r.code?'−':'+'}</button></td><td>{r.load}</td><td>{r.reason||'Não informado'}</td><td>{r.received_at||r.included_at||'—'}</td><td><span className="tag">{r.status}</span>{r.is_test&&<span className="tag"> TESTE</span>}</td><td>{r.items.length||'—'}</td></tr>{open===r.code&&<tr><td colSpan={6}><div className="details"><strong>{r.origin} / {r.destination}</strong><p>BDV: {r.bdv||'—'} · Notas: {r.invoices?.map(n=>n.number+'/'+n.series).join(', ')||'—'}</p>{r.items.length?r.items.map((i,index)=><div className="item" key={index}><span>{i.code} · {i.description}</span><span>{i.quantity} {i.package} · {i.total==null?'Valor não informado':money(Number(i.total))}</span></div>):<p>Nenhum item visível.</p>}</div></td></tr>}</React.Fragment>)}{!data.length&&<tr><td colSpan={6} className="empty">Nenhum chamado encontrado.</td></tr>}</tbody></table></div>}
 const sum=(reason:string)=>scoped.filter(r=>r.reason.toUpperCase()===reason).flatMap(r=>r.items).reduce((a,i)=>a+(i.total==null?0:Number(i.total)),0);
 const missing=scoped.flatMap(r=>r.items).filter(i=>i.total==null).length;
 function exportCsv(){
  const escape=(v:unknown)=>{const s=String(v??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"'};
  const rows=[['Chamado','Carga','BDV','Motivo','Status','PLU','Produto','Quantidade','Embalagem','Valor informado'],...filtered.flatMap(r=>(r.items.length?r.items:[null]).map(i=>[r.code,r.load,r.bdv,r.reason,r.status,i?.code,i?.description,i?.quantity,i?.package,i?.total]))];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(escape).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rm-control.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="layout"><aside><div className="brand"><span className="logo">RM</span><div><b>RM Control</b><small>Operações logísticas</small></div></div><p className="nav-label">GERENCIAMENTO</p>{([['overview','Visão geral'],['records','Chamados'],['import','Importar dados']] as const).map(([key,label])=><button key={key} className={'nav '+(page===key?'active':'')} onClick={()=>setPage(key)}>{label}</button>)}<footer>Versão 0.2 · Desenvolvimento<br/>Uso local autorizado</footer></aside><main><header><div><small>Workspace / Operações</small><h1>{page==='overview'?'Visão geral':page==='records'?'Chamados':'Importar dados'}</h1></div><span className={'connection '+(connected?'on':'')}>{connected?'API conectada':'API desconectada'}</span></header>{error&&<div role="alert" className="alert">{error} <button className="link" onClick={()=>{setError('');void refresh()}}>Reconectar</button></div>}{notice&&<div role="status" className="notice">{notice}</div>}{!connected&&<section className="panel"><label htmlFor="token">Token de acesso (se configurado no backend)</label><div className="filters"><input id="token" type="password" value={token} onChange={e=>setToken(e.target.value)}/><button className="primary" onClick={()=>{accessToken=token;setError('');void refresh()}}>Conectar</button></div></section>}{page!=='import'&&<section className="panel filters"><label>De <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label><input type="checkbox" checked={includeTests} onChange={e=>setIncludeTests(e.target.checked)}/> Incluir testes</label></section>}
 {page==='overview'&&<><div className="intro"><div><h2>Acompanhamento operacional</h2><p>Consulte ocorrências e importe registros em um único lugar.</p></div><button className="primary" onClick={()=>setPage('import')}>+ Nova importação</button></div><div className="metrics">{[['Chamados',scoped.length],['Itens cadastrados',scoped.reduce((a,r)=>a+r.items.length,0)],['Aguardando análise',scoped.filter(r=>r.status==='AGU. ANALISE').length],['Sem itens visíveis',scoped.filter(r=>!r.items.length).length]].map(([label,value])=><section className="panel metric" key={label}><small>{label}</small><strong>{value}</strong></section>)}</div><section className="panel"><h2>Valores informados (não equivalem a ressarcimento aprovado)</h2><div className="metrics">{[['Sobras',money(sum('SOBRA'))],['Faltas',money(sum('FALTA'))],['Avarias',money(sum('AVARIA'))],['Saldo informado',money(sum('SOBRA')-sum('FALTA')-sum('AVARIA'))]].map(([label,value])=><div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><p>{missing} itens sem valor informado. Os totais são parciais enquanto houver dados ausentes.</p></section><section className="panel"><h2>Situação dos chamados</h2>{counts.length?counts.map(([label,count])=><div className="barrow" key={label}><span>{label}</span><div className="track"><div style={{width:(count/scoped.length*100)+'%'}}/></div><b>{count}</b></div>):<p className="muted">Importe dados para visualizar os indicadores.</p>}</section><section className="panel"><h2>Chamados cadastrados</h2>{table(scoped.slice(0,8))}</section></>}
 {page==='records'&&<section className="panel"><div className="filters"><input aria-label="Pesquisar" placeholder="Buscar chamado, carga ou PLU" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option>{[...new Set(records.map(r=>r.status))].map(s=><option key={s}>{s}</option>)}</select><select aria-label="Motivo" value={reason} onChange={e=>setReason(e.target.value)}><option value="">Todos os motivos</option>{[...new Set(records.map(r=>r.reason).filter(Boolean))].map(s=><option key={s}>{s}</option>)}</select></div><div className="actions"><button className="secondary" onClick={exportCsv}>Exportar CSV</button></div><p className="muted">{filtered.length} registros</p>{table(filtered)}</section>}
 {page==='import'&&<><section className="panel"><h2>Importação de ocorrências</h2><p>Copie a listagem de chamados e cole abaixo. Expanda as linhas de produtos antes de copiar. Use apenas dados autorizados.</p><label htmlFor="xlsx">Histórico XLSX (opcional)</label><input id="xlsx" type="file" accept=".xlsx" onChange={e=>{setUpload(e.target.files?.[0]||null);setPreview(null)}}/>{upload&&<button className="secondary" onClick={()=>{setUpload(null);setPreview(null);const input=document.getElementById('xlsx') as HTMLInputElement;input.value=''}}>Remover arquivo</button>}<label htmlFor="target">Código do chamado detalhado (opcional, para resolver ambiguidades)</label><input id="target" value={target} onChange={e=>{setTarget(e.target.value);setPreview(null)}} disabled={!!upload}/><label htmlFor="paste">Conteúdo copiado</label><textarea id="paste" disabled={!!upload} value={raw} onChange={e=>{setRaw(e.target.value);setPreview(null)}} placeholder="Cole os registros aqui..." rows={10}/><div className="actions"><button className="secondary" onClick={()=>{setRaw(sample);setPreview(null)}} disabled={busy||!!upload}>Usar exemplo fictício</button><button className="primary" disabled={busy||(!upload&&!raw.trim())} onClick={()=>void analyze()}>{busy?'Processando…':'Analisar dados'}</button></div></section>{preview&&<section className="panel"><h2>Conferência da importação</h2><p>{preview.records.length} chamados reconhecidos. Revise os avisos antes de salvar. {preview.blocked?'Importação bloqueada: corrija os conflitos.':''}</p>{preview.warnings.map((w,i)=><div className="alert" key={i}>{w}</div>)}{table(preview.records)}<div className="actions"><button className="primary" disabled={busy||!preview.records.length||preview.blocked} onClick={()=>void save()}>Confirmar importação</button></div></section>}</>}
 </main></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
