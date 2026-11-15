import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/consulta.js';

const TOKEN = 'uma-chave-muito-forte-para-uso-em-testes-2026';
process.env.PONTE_TOKEN = TOKEN;
process.env.VERCEL_REGION = 'gru1';

function criarRes() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(nome, valor) { this.headers[nome] = valor; },
    status(codigo) { this.statusCode = codigo; return this; },
    json(dados) { this.body = dados; return this; },
  };
}
function req(body = {}) {
  return {
    method: 'POST',
    headers: { 'x-ponte-token': TOKEN },
    body: {
      tipo: 'texto', termo: 'Leonardo Souza da Cruz', tribunal: 'TJRO',
      inicio: '2026-11-01', fim: '2026-11-15', pagina: 1, porPagina: 20,
      ...body,
    },
  };
}

test('nega acesso sem chave correta', async () => {
  const r = req(); r.headers['x-ponte-token'] = 'errado';
  const res = criarRes(); await handler(r, res);
  assert.equal(res.statusCode, 401);
});

test('rejeita datas inválidas e intervalos longos', async () => {
  const r = req({ fim: '2026-12-15' });
  const res = criarRes(); await handler(r, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.erro, /31 dias/);
});

test('consulta com parâmetros corretos e normaliza o retorno', async () => {
  const antigo = globalThis.fetch;
  let urlFinal;
  globalThis.fetch = async (url) => {
    urlFinal = new URL(url);
    return {
      ok: true, status: 200,
      async json() { return { count: 1, items: [{ numeroProcesso: '123', siglaTribunal: 'TJRO', nomeOrgao: 'Vara', texto: 'Exemplo de comunicação pública' }] }; },
    };
  };
  try {
    const res = criarRes();
    await handler(req(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(urlFinal.origin, 'https://comunicaapi.pje.jus.br');
    assert.equal(urlFinal.searchParams.get('texto'), 'Leonardo Souza da Cruz');
    assert.equal(urlFinal.searchParams.get('siglaTribunal'), 'TJRO');
    assert.equal(res.body.total, 1);
    assert.equal(res.body.resultados[0].texto, 'Exemplo de comunicação pública');
    assert.equal(res.body.regiaoConfigurada, 'gru1');
  } finally { globalThis.fetch = antigo; }
});

test('informa quando o CNJ nega o IP', async () => {
  const antigo = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  try {
    const res = criarRes(); await handler(req(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.codigoCNJ, 403);
  } finally { globalThis.fetch = antigo; }
});

test('aceita busca por processo apenas com 20 dígitos', async () => {
  const res = criarRes();
  await handler(req({ tipo: 'numeroProcesso', termo: '12345' }), res);
  assert.equal(res.statusCode, 400);
});
