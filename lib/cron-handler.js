import {json,authCron} from './auth.js';
import {runCron} from './radar.js';
export async function cronHandler(req,res){if(req.method!=='GET')return json(res,405,{erro:'Use GET'});if(!authCron(req))return json(res,401,{erro:'Não autorizado'});try{const data=await runCron();return json(res,data.resultados?.some(r=>r.status==='erro')?502:200,data)}catch(e){return json(res,503,{erro:String(e.message||e)})}}
