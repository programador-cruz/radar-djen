import { timingSafeEqual } from 'node:crypto';

// Endpoint fixo: a ponte NÃO é um proxy genérico.
const URL_DJEN = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const TIPOS = new Set(['nomeParte', 'nomeAdvogado', 'texto', 'numeroProcesso']);

function json(res, status, dados) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(dados);
}

function segredoValido(recebido, esperado) {
  if (typeof recebido !== 'string' || typeof esperado !== 'string' || !esperado) return false;
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseData(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data : null;
}

function normalizar(item) {
  const texto = item.texto ?? item.teor ?? '';
  return {
    id: item.id ?? item.hash ?? null,
    numeroProcesso: item.numeroProcesso ?? item.numero_processo ?? '',
    tribunal: item.siglaTribunal ?? item.sigla_tribunal ?? '',
    orgao: item.nomeOrgao ?? item.orgao ?? '',
    dataDisponibilizacao: item.dataDisponibilizacao ?? item.data_disponibilizacao ?? '',
    tipoDocumento: item.tipoDocumento ?? item.tipo_documento ?? item.tipoComunicacao ?? '',
    texto: typeof texto === 'string' ? texto : String(texto),
    link: typeof item.link === 'string' ? item.link : '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { erro: 'Use POST para consultar.' });
  }

  const segredo = process.env.PONTE_TOKEN;
  if (!segredo || segredo.length < 24) {
    return json(res, 503, { erro: 'A variável PONTE_TOKEN precisa ser configurada na Vercel (mínimo de 24 caracteres).' });
  }
  if (!segredoValido(req.headers['x-ponte-token'], segredo)) {
    return json(res, 401, { erro: 'Chave de acesso incorreta.' });
  }

  try {
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    const tipo = corpo.tipo;
    const termo = typeof corpo.termo === 'string' ? corpo.termo.trim().replace(/\s+/g, ' ') : '';
    const tribunal = typeof corpo.tribunal === 'string' ? corpo.tribunal.trim().toUpperCase() : '';
    const inicio = parseData(corpo.inicio);
    const fim = parseData(corpo.fim);
    const pagina = Number(corpo.pagina ?? 1);
    const porPagina = Number(corpo.porPagina ?? 20);

    if (!TIPOS.has(tipo)) return json(res, 400, { erro: 'Selecione um tipo de busca válido.' });
    if (termo.length < 3 || termo.length > 120) return json(res, 400, { erro: 'Informe um nome ou número de processo entre 3 e 120 caracteres.' });
    if (tipo === 'numeroProcesso' && !/^\d{20}$/.test(termo.replace(/\D/g, ''))) {
      return json(res, 400, { erro: 'O número CNJ do processo deve conter 20 dígitos.' });
    }
    if (tribunal && !/^[A-Z0-9]{2,8}$/.test(tribunal)) return json(res, 400, { erro: 'Sigla do tribunal inválida.' });
    if (!inicio || !fim || inicio > fim) return json(res, 400, { erro: 'Informe um intervalo de datas válido.' });
    const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
    if (dias > 30) return json(res, 400, { erro: 'Consulte no máximo 31 dias por vez, para respeitar o serviço do CNJ.' });
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100) return json(res, 400, { erro: 'Página fora do intervalo permitido (1 a 100).' });
    if (![10, 20, 50].includes(porPagina)) return json(res, 400, { erro: 'Quantidade por página inválida.' });

    const params = new URLSearchParams({
      [tipo]: tipo === 'numeroProcesso' ? termo.replace(/\D/g, '') : termo,
      dataDisponibilizacaoInicio: corpo.inicio,
      dataDisponibilizacaoFim: corpo.fim,
      pagina: String(pagina),
      itensPorPagina: String(porPagina),
    });
    if (tribunal) params.set('siglaTribunal', tribunal);

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 15000);
    let resposta;
    try {
      resposta = await fetch(`${URL_DJEN}?${params}`, {
        headers: { Accept: 'application/json' },
        signal: controlador.signal,
        redirect: 'error',
      });
    } finally {
      clearTimeout(temporizador);
    }

    if (resposta.status === 403) {
      return json(res, 502, {
        erro: 'O CNJ recusou a requisição (HTTP 403). Mesmo em São Paulo, um IP de datacenter pode ser bloqueado.',
        codigoCNJ: 403,
      });
    }
    if (resposta.status === 429) {
      return json(res, 429, { erro: 'O CNJ atingiu o limite de consultas. Aguarde e tente novamente.', codigoCNJ: 429 });
    }
    if (!resposta.ok) {
      return json(res, 502, { erro: `O CNJ respondeu com HTTP ${resposta.status}.`, codigoCNJ: resposta.status });
    }

    let dados;
    try {
      dados = await resposta.json();
    } catch {
      return json(res, 502, { erro: 'O CNJ não devolveu JSON. Confira se a API está disponível.' });
    }
    const items = Array.isArray(dados?.items) ? dados.items :
      Array.isArray(dados?.content) ? dados.content :
      Array.isArray(dados?.data) ? dados.data : [];
    const total = Number.isFinite(Number(dados?.count)) ? Number(dados.count) :
      Number.isFinite(Number(dados?.totalElements)) ? Number(dados.totalElements) : items.length;

    return json(res, 200, {
      total,
      pagina,
      porPagina,
      resultados: items.map(normalizar),
      fonte: 'API pública do DJEN/CNJ',
      regiaoConfigurada: process.env.VERCEL_REGION || 'local',
      observacao: 'Consulta informativa. Confirme sempre no portal oficial.',
    });
  } catch (erro) {
    if (erro?.name === 'AbortError') return json(res, 504, { erro: 'A consulta demorou mais de 15 segundos. Tente um período menor.' });
    if (erro instanceof SyntaxError) return json(res, 400, { erro: 'Corpo JSON inválido.' });
    return json(res, 502, { erro: 'Não foi possível conectar à API pública do DJEN.' });
  }
}
