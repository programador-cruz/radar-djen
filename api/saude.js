export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    regiao: process.env.VERCEL_REGION || 'local',
    configurada: Boolean(process.env.PONTE_TOKEN && process.env.PONTE_TOKEN.length >= 24),
    aviso: 'Este teste verifica apenas a ponte. Não testa a conectividade com o CNJ.',
  });
}
