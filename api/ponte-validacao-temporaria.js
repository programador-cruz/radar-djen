import {readConfig,readRows} from '../lib/google.js';
import {runTribunal} from '../lib/radar.js';

const expira=Date.parse('2026-11-15T23:55:00Z');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(req.method!=='GET'||Date.now()>expira)return res.status(404).json({erro:'Indisponivel'});
 try{
  const execucoes=await readRows('Execucoes','A1:J1000');
  if(execucoes.slice(1).some(r=>r[1]==='diagnostico'))return res.status(200).json({googleSheets:true,jaExecutado:true});
  const cfg=await readConfig();
  const result=await runTribunal({cfg,tribunal:'TJRO',inicio:'2026-11-01',fim:'2026-11-15',origem:'diagnostico'});
  return res.status(result.status==='ok'?200:502).json({googleSheets:true,resultado:result});
 }catch(e){return res.status(503).json({googleSheets:false,erro:String(e?.message||e).slice(0,220)})}
}
