# Radar DJEN v2 — integração em preparação

Consulta manual da versão 1 preservada. Esta branch acrescenta integração opcional com Google Sheets, três rotas agendadas e um painel protegido.

## Antes de publicar em produção

1. Ative a Google Sheets API num projeto Google Cloud da sua conta.
2. Crie uma conta de serviço e descarregue a chave JSON de forma privada. **Nunca a inclua no repositório nem a envie por chat.**
3. Copie o `client_email` da conta de serviço e partilhe **apenas** a planilha [Radar DJEN](https://docs.google.com/spreadsheets/d/11qWfllKLJt7RBKtAG-gqjPNIagdYwh8HxQN73xT58GQ/edit) com essa conta como Editor.
4. Configure em Vercel → Settings → Environment Variables (Production):
   - `PONTE_TOKEN`: manter o valor existente;
   - `GOOGLE_SHEET_ID`: `11qWfllKLJt7RBKtAG-gqjPNIagdYwh8HxQN73xT58GQ`;
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço, mantido em segredo;
   - `CRON_SECRET`: segredo distinto, com pelo menos 32 caracteres.
5. Só depois dessas configurações, faça o merge para `main`. Confirme os logs do deploy e a consulta manual.

## Rotinas

`vercel.json` define três horários UTC nos dias úteis:
- `/api/cron12`: 12h UTC = 8h Rondônia
- `/api/cron17`: 17h UTC = 13h Rondônia
- `/api/cron22`: 22h UTC = 18h Rondônia

Os agendamentos enviam automaticamente `Authorization: Bearer CRON_SECRET`. O horário da Vercel Hobby pode ter variação. Cada execução lê a aba `Config`, consulta os tribunais na ordem e grava novas linhas em `Publicacoes` e `Execucoes`. O código nunca escreve em `Leitura_Claude` ou `Config`.

## Histórico

`POST /api/backfill` requer `x-ponte-token: PONTE_TOKEN`. **Cada chamada processa um tribunal num mês**, retomando do último lote terminado na aba `Execucoes`. Repita sequencialmente até `concluido: true`. Não faça backfill e cron em paralelo: Google Sheets não oferece travamento atômico por `id_djen`. As chamadas devem respeitar os limites de uso do CNJ.

## Painel

`/painel` exibe as publicações, filtros, status `Leitura_Claude` e últimas execuções; a API `/api/painel` requer `x-ponte-token`. O painel exige a chave antes de solicitar dados, mas a página HTML pública não contém informações restritas.

## Limitações

Não há mecanismo de descoberta de decisões não publicadas. A API do DJEN só encontra publicações indexadas pelo CNJ. Bloqueios ou limites de acesso do CNJ são devolvidos como erros. Feriados exigem revisão da lógica de dias úteis. O monitoramento não substitui verificações processuais.

## Testes

Execute `npm test`; é necessário completar validação da função real Vercel ↔ Google Sheets ↔ CNJ antes de ativar os agendamentos. Não há garantias de ausência de duplicidade sob concorrência; executar sequencialmente.
