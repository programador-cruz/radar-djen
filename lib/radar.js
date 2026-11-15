import {readConfig,readRows,appendRows,existingIds} from './google.js';
const ENDPOINT='https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const date=d=>d.toISOString().slice(0,10);
const minus=(d,n)=>date(new Date(Date.parse(d+'T00:00:00Z')-n*86400000));
const plain=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const cleanHTML=s=>String(s||'').replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\s*\/p\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
export function formatPublication(item,tribunal,cfg,origin){
 const id=item?.id??item?.hash;if(id==null||String(id).trim()==='')throw Error('Publicação sem id_djen, gravação cancelada');
 const full=cleanHTML(item.texto??item.teor??'');const index=plain(full).indexOf(plain(cfg.termo));
 const trecho=full.slice(index<0?0:Math.max(index-170,0),(index<0?0:Math.max(index-170,0))+500);
 const termos=(cfg.termosDestaque||[]).filter(t=>plain(full).includes(plain(t))).join('; ');
 const mask=String(item.numeroProcesso??item.numero_processo??'');
 const digits=mask.replace(/\D/g,'');
 const recipients=Array.isArray(item.destinatarios)?item.destinatarios.map(x=>typeof x==='string'?x:(x.nome||x.nomeDestinatario||'')).filter(Boolean).join('; '):String(item.nomeDestinatario??'');
 return [String(id),String(item.dataDisponibilizacao??item.data_disponibilizacao??'').slice(0,10),String(item.siglaTribunal||tribunal),digits.length===20?digits:'',mask,String(item.nomeOrgao??item.orgao??''),String(item.nomeClasse??item.classe??''),String(item.tipoComunicacao??''),String(item.tipoDocumento??''),recipients,termos,trecho,full.slice(0,45000),String(item.link??''),origin,new Date().toISOString()];
}
async function query(cfg,tribunal,start,end){
 const all=[];let pages=0;
 for(let page=1;page<=100;page++){
  const params=new URLSearchParams({texto:cfg.termo,siglaTribunal:tribunal,dataDisponibilizacaoInicio:start,dataDisponibilizacaoFim:end,pagina:String(page),itensPorPagina:'50'});
  let response,error;for(let attempt=0;attempt<3;attempt++){
   try{response=await fetch(ENDPOINT+'?'+params,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok){error=Error('CNJ HTTP '+response.status);if(![429,500,502,503,504].includes(response.status)||attempt===2)throw error;await sleep(600*2**attempt);continue;}break;
   }catch(e){error=e;if(attempt===2)throw error;await sleep(600*2**attempt);}
  }
  const body=await response.json();const items=Array.isArray(body.items)?body.items:Array.isArray(body.data)?body.data:Array.isArray(body.content)?body.content:null;
  if(!items)throw Error('CNJ retornou JSON sem lista de publicações conhecida');
  all.push(...items);pages=page;const total=Number(body.count??body.totalElements??body.total);
  if(items.length===0||(Number.isFinite(total)&&all.length>=total)||items.length<50)return {items:all,pages};
  await sleep(250);
 }
 throw Error('Limite de páginas do CNJ atingido');
}
export async function runTribunal({cfg,tribunal,inicio,fim,origem}){
 const at=new Date().toISOString();let paginas=0,encontradas=0,novas=0;
 try{
  const result=await query(cfg,tribunal,inicio,fim);paginas=result.pages;encontradas=result.items.length;
  const seen=await existingIds();const rows=[];
  for(const item of result.items){const row=formatPublication(item,tribunal,cfg,origem);if(!seen.has(row[0])){seen.add(row[0]);rows.push(row);}}
  for(let i=0;i<rows.length;i+=100){const chunk=rows.slice(i,i+100);await appendRows('Publicacoes',chunk);novas+=chunk.length;}
  await appendRows('Execucoes',[[at,origem,tribunal,inicio,fim,paginas,encontradas,novas,'ok','']]);
  return {tribunal,inicio,fim,paginas,encontradas,novas,status:'ok'};
 }catch(e){
  const erro=String(e.message||e).slice(0,500);
  await appendRows('Execucoes',[[at,origem,tribunal,inicio,fim,paginas,encontradas,novas,'erro',erro]]);
  return {tribunal,inicio,fim,paginas,encontradas,novas,status:'erro',erro};
 }
}
export async function runCron(){
 const now=new Date();if([0,6].includes(now.getUTCDay()))return {ignorado:'fim de semana UTC'};
 const cfg=await readConfig(),fim=date(now),inicio=minus(fim,cfg.janelaDias),resultados=[];
 for(const tribunal of cfg.tribunais)resultados.push(await runTribunal({cfg,tribunal,inicio,fim,origem:'cron'}));
 return {janela:[inicio,fim],resultados};
}
export function monthWindows(from,to){
 const end=new Date(to+'T00:00:00Z');let cur=new Date(from+'T00:00:00Z');const out=[];
 if(!Number.isFinite(end.getTime())||!Number.isFinite(cur.getTime())||cur>end)throw Error('Datas inválidas');
 while(cur<=end){const m=new Date(Date.UTC(cur.getUTCFullYear(),cur.getUTCMonth()+1,0));const finish=m<end?m:end;out.push([date(cur),date(finish)]);cur=new Date(finish.getTime()+86400000);}return out;
}
export async function nextHistorical(){
 const cfg=await readConfig();const jobs=monthWindows(cfg.backfillInicio,date(new Date())).flatMap(([inicio,fim])=>cfg.tribunais.map(tribunal=>({cfg,tribunal,inicio,fim,origem:'backfill'})));
 const lines=await readRows('Execucoes','A1:J50000');const done=new Set(lines.slice(1).filter(r=>r[1]==='backfill'&&r[8]==='ok').map(r=>[r[2],r[3],r[4]].join(':')));
 return {next:jobs.find(j=>!done.has([j.tribunal,j.inicio,j.fim].join(':')))||null,completed:jobs.filter(j=>done.has([j.tribunal,j.inicio,j.fim].join(':'))).length,total:jobs.length};
}
export async function panelData(){
 const [pub,logs,read]=await Promise.all([readRows('Publicacoes','A1:P50000'),readRows('Execucoes','A1:J50000'),readRows('Leitura_Claude','A1:H50000')]);
 const ack=new Map(read.slice(1).filter(r=>r[0]).map(r=>[String(r[0]),{classificacao:r[2]||'',acao:r[4]||'',prazo:r[6]||''}]));
 const publicacoes=pub.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),data:r[1]||'',tribunal:r[2]||'',processo:r[4]||r[3]||'',orgao:r[5]||'',tipo:r[8]||r[7]||'',termos:r[10]||'',trecho:r[11]||'',link:r[13]||'',central:ack.get(String(r[0]))||null})).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
 const execucoes=logs.slice(1).filter(r=>r[0]).map(r=>({hora:r[0],origem:r[1],tribunal:r[2],inicio:r[3],fim:r[4],encontradas:r[6],novas:r[7],status:r[8],erro:r[9]||''})).reverse();
 const today=date(new Date()),week=minus(today,6);
 return {resumo:{hoje:publicacoes.filter(p=>p.data===today).length,semana:publicacoes.filter(p=>p.data>=week).length,total:publicacoes.length,ultima:execucoes[0]||null},publicacoes:publicacoes.slice(0,3000),execucoes:execucoes.slice(0,100)};
}
