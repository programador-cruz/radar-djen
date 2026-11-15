# Ponte DJEN — consulta privada via Vercel em São Paulo

Projeto simples que permite consultar a **API pública do Diário de Justiça Eletrônico Nacional (DJEN)** por um painel privado. A requisição de saída é feita por uma Vercel Function configurada para a região **`gru1` (São Paulo, Brasil)**.

**Importante:** isto não garante acesso. O CNJ pode negar requisições de IPs de datacenter, mesmo no Brasil. O código não contorna autenticação, CAPTCHA, limites de acesso ou bloqueios adicionais: nesses casos, informa o erro.

## O que faz

- Busca nome de parte, nome de advogado, nome mencionado no texto ou número de processo.
- Filtra por intervalo de datas e sigla do tribunal (ex.: `TJRO`, `TRT14`).
- Devolve o total de resultados, dados de publicação, texto e eventual link oficial.
- Exige chave secreta configurada como variável de ambiente `PONTE_TOKEN`.
- Não armazena consultas em banco de dados nem registra o texto deliberadamente.
- Limita consultas a intervalos de 31 dias, no máximo 50 resultados por página, e não faz consultas automáticas.

## Como publicar na Vercel

1. Descompacte este ZIP no computador.
2. Crie um repositório **privado** no GitHub e envie o conteúdo da pasta `ponte-djen-vercel` (ou use a CLI da Vercel se preferir).
3. Abra https://vercel.com/new e importe o repositório.
4. Escolha **Framework Preset: Other**, se solicitado, e a raiz que contém `vercel.json`.
5. Nas configurações do projeto, adicione a variável de ambiente **`PONTE_TOKEN`**, com uma chave aleatória forte de **pelo menos 24 caracteres**. Sugestão: gere-a localmente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
6. Faça o deploy e, em **Settings → Functions**, confirme a região **São Paulo (`gru1`)**. O arquivo `vercel.json` já solicita essa região.
7. Abra a URL fornecida pela Vercel. Informe a chave e clique em **Consultar DJEN**.

Se alterar a variável de ambiente depois, execute um novo deploy para que a função use a alteração.

## Como verificar

- Visite `https://SEU-SITE.vercel.app/api/saude`.
- O resultado precisa mostrar `"regiao":"gru1"` e `"configurada":true`. **Isso só verifica a configuração**: não confirma acesso ao CNJ.
- Faça uma consulta real pelo painel. Se aparecer HTTP 403, o CNJ não aceitou o IP de saída.

## Observação sobre nomeações de peritos

O DJEN pode mencionar o perito no **inteiro teor da publicação**. Por isso o painel começa com o modo “Nome mencionado no texto”. Se não aparecer resultado, tente períodos mais curtos, `TJRO`, `TRT14` e número de processo. Uma ausência no DJEN **não** prova que não houve nomeação: consulte também os sistemas processuais pertinentes (PJe/eproc, conforme o tribunal).

## Política de uso

Use apenas para consultas públicas e autorizadas, respeitando as regras, limites de taxa e disponibilidade do CNJ. O acesso não automatiza login nem publica informações protegidas. Não é canal oficial de intimação e **não substitui** o acompanhamento processual pelo profissional responsável.

## Arquivos

- `public/index.html`: painel web responsivo.
- `api/consulta.js`: função de consulta, validação e autenticação.
- `api/saude.js`: diagnóstico básico da configuração.
- `vercel.json`: região São Paulo `gru1`.
- `tests/consulta.test.js`: testes locais de validação e respostas simuladas da API.

## Desenvolvimento e testes

Requer Node.js 20 ou superior.

```bash
npm test
```

Os testes simulam respostas do CNJ e não verificam se o IP real de produção será aceito.

Fontes técnicas:

- Documentação da Vercel: https://vercel.com/docs/functions/configuring-functions/region
- Regiões da Vercel: https://vercel.com/docs/regions
- Portal do CNJ: https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/
- Documentação da API do DJEN: https://comunicaapi.pje.jus.br/swagger/index.html
