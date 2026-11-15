import {authUser,json} from '../lib/auth.js';
import {panelData} from '../lib/radar.js';
export default async function handler(req,res){if(req.method!=='GET')return json(res,405,{erro:'Use GET'});if(!authUser(req))return json(res,401,{erro:'Chave inválida'});try{return json(res,200,await panelData())}catch(e){return json(res,503,{erro:String(e.message||e)})}}
