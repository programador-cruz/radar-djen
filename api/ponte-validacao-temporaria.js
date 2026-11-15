import {readConfig} from '../lib/google.js';
import {runTribunal} from '../lib/radar.js';

const chaveTemporaria='qCQqBESONnF01RRRMCHiU4kz_AUbuMU3';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({erro:'Metodo nao permitido'});
 if(req.query?.chave!==chaveTemporaria)return res.status(404).json({erro:'Nao encontrado'});
 try{
  const cfg=await readConfig();
  const tribunal='TJRO';
  const result=await runTribunal({cfg,tribunal,inicio:'2026-11-01',fim:'2026-11-15',origem:'diagnostico'});
  return res.status(result.status==='ok'?200:502).json({configGoogle:true,resultado:result});
 }catch(e){return res.status(503).json({configGoogle:false,erro:String(e?.message||e).slice(0,250)})}
}
