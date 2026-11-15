import {timingSafeEqual} from 'node:crypto';
export function same(a,b){if(typeof a!=='string'||typeof b!=='string'||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function json(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body)}
export function authUser(req){const s=process.env.PONTE_TOKEN;return !!s&&s.length>=24&&same(req.headers['x-ponte-token'],s)}
export function authCron(req){const s=process.env.CRON_SECRET;return !!s&&s.length>=32&&same(req.headers.authorization,'Bearer '+s)}
