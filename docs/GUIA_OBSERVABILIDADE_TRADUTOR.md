# Estudo — Observabilidade no `vlibras-translator-api`

Estudo de viabilidade e plano de implementação, aplicando ao tradutor o padrão já implementado e validado no `stats-api` (ver `DOCUMENTACAO_OBSERVABILIDADE_STATS_API.md` e `GUIA_IMPLEMENTACAO_OBSERVABILIDADE_OUTROS_SERVICOS.md`). Baseado na leitura do código atual do repositório — nada aqui foi implementado ainda.

## Sumário

1. [Respostas às perguntas iniciais do guia](#1-respostas-às-perguntas-iniciais-do-guia)
2. [O que já existe hoje](#2-o-que-já-existe-hoje)
3. [Diferenças do tradutor em relação ao `stats-api`](#3-diferenças-do-tradutor-em-relação-ao-stats-api)
4. [Etapa 1 — Logs estruturados](#4-etapa-1--logs-estruturados)
5. [Etapa 2 — Métricas próprias (Prometheus)](#5-etapa-2--métricas-próprias-prometheus)
6. [Etapa 3 — Tracing distribuído (OpenTelemetry)](#6-etapa-3--tracing-distribuído-opentelemetry)
7. [Etapa 4 — Exemplars](#7-etapa-4--exemplars)
8. [Deploy (Helm / Prometheus)](#8-deploy-helm--prometheus)
9. [Problemas encontrados no código durante o estudo](#9-problemas-encontrados-no-código-durante-o-estudo)
10. [Plano de execução e checklist](#10-plano-de-execução-e-checklist)
11. [Pontos a confirmar antes de começar](#11-pontos-a-confirmar-antes-de-começar)

---

## 1. Respostas às perguntas iniciais do guia

| Pergunta do guia | Resposta no tradutor |
|---|---|
| Qual a stack? | **Node.js (≥ 24) em JavaScript puro**, sem TypeScript. As mesmas bibliotecas do `stats-api` são reaproveitáveis (`prom-client`, `pino`, `@opentelemetry/*`). |
| Qual framework HTTP? | **Express 4** — o mesmo do `stats-api`, então a `@opentelemetry/instrumentation-express` serve direto. Banco via **Sequelize 6** → `pg` (PostgreSQL), cache via **ioredis**, tradução via **RPC no RabbitMQ** (`amqplib`), análise de sentimento via `fetch` nativo para a **DeepSeek**. |
| Formato de módulo? | **ESM** (`"type": "module"` no `package.json`). O `stats-api` é CommonJS — isso muda a forma de carregar o tracing (ver seção 6). |
| Já tem logger estruturado? | **Não.** Há três formas de log misturadas: `morgan` (acesso HTTP), `debug` ([debugger.js](../src/app/util/debugger.js)) e muitos `console.*` em texto livre. |

## 2. O que já existe hoje

| Item | Situação | Onde |
|---|---|---|
| Log de acesso HTTP | `morgan`, formato vindo de `LOGGER_FORMAT` (`production` no Helm) | [app.js:48](../src/app/app.js#L48) |
| Logs da aplicação | `debug` (`vlibras-translator-api:info`, `:error`, `-cache:error`, `-db:error`) + `console.*` | [debugger.js](../src/app/util/debugger.js), [textTranslator.js](../src/app/translator/textTranslator.js), [queueConnection.js](../src/app/util/queueConnection.js) |
| ID por requisição | `req.uid` (UUID), também usado como `correlationId` no RabbitMQ — mas registrado depois do `morgan`, então não aparece no log de acesso | [attachUid.js](../src/app/middlewares/attachUid.js), [app.js:52](../src/app/app.js#L52) |
| Rota `/metrics` | **São métricas de negócio em JSON** (contagem de traduções, reviews, ratings, top 10 hits), consumidas pelo `stats-api`. **Não são Prometheus.** | [metrics.js](../src/app/metrics/metrics.js), [metricsRoute.js](../src/app/metrics/metricsRoute.js) |
| Health | `/health` (público) e `/status` (detalhado: banco, fila, redis, `consumerCount`) | [health.js](../src/app/health/health.js) |
| Autenticação de rotas operacionais | `apiKeyAuth` com bypass por host interno (`INTERNAL_AUTH_BYPASS_*`) | [apiKeyAuth.js](../src/app/middlewares/apiKeyAuth.js) |
| `prom-client` / OpenTelemetry | **Não instalados** | `package.json` |

Ou seja: todas as etapas partem do zero, inclusive logs.

## 3. Diferenças do tradutor em relação ao `stats-api`

Pontos em que o guia **não se aplica literalmente** e precisa de adaptação:

1. **ESM em vez de CommonJS.** O truque "importar `tracing.ts` na primeira linha" do `stats-api` **não basta** em ESM: Express, `pg`, `ioredis` e `amqplib` são carregados pelo loader ESM e não passam pelo hook de `require`. O tracing precisa ser carregado com `node --import` e o hook `import-in-the-middle`.
2. **A dependência principal é uma fila, não HTTP.** A tradução é um RPC no RabbitMQ: publica em `TRANSLATOR_QUEUE` (`translate.to_text4` em produção) e espera a resposta em `amq.rabbitmq.reply-to`, com timeout de 30s ([timeout.js](../src/config/timeout.js)). O equivalente do `HttpClient` instrumentado do `stats-api` aqui é o **RPC na fila**.
3. **A lógica do RPC está duplicada em quatro lugares**: `textTranslator`, `sentimentTranslator`, `textTranslatorHealth` (usado pelo `/status`) e `requestQueueReply` em [amqpRpc.js](../src/app/translator/amqpRpc.js) (usado só pelo refinamento de glosa). Instrumentar sem unificar significa instrumentar quatro vezes.
4. **O `fetch` nativo não é coberto pela instrumentação `http`.** A chamada à DeepSeek ([sentimentAnalyzer.js:68](../src/app/util/sentimentAnalyzer.js#L68)) usa `global.fetch` (undici); é preciso a `@opentelemetry/instrumentation-undici`.
5. **Não há Background Polling a replicar.** O `/metrics` (JSON) consulta o **próprio** banco, não serviços externos — o problema que motivou o `BackgroundCollector` do `stats-api` não existe aqui.
6. **A rota `/metrics` já está ocupada** por um contrato de negócio consumido pelo `stats-api`. O endpoint Prometheus precisa de outro caminho (ver seção 5.1).
7. **6 réplicas** (`replicaCount: 6` em [values.yaml](../deploy/helm/values.yaml)). O `stats-api` tem uma réplica só; aqui o scrape precisa ser **por pod** (ver seção 8).
8. **O trace distribuído mais valioso passa por outro serviço/linguagem.** O ganho real é ver `stats-api → tradutor → fila → worker` num trace só, mas isso depende do worker (provavelmente o core em Python) também adotar OpenTelemetry.

## 4. Etapa 1 — Logs estruturados

Esforço médio — é a etapa que, no dicionário, já estava meio pronta, e aqui parte do zero. Mudanças sugeridas:

1. **Logger único** em `src/app/util/logger.js`: Pino, campos base `service`, `version`, `env`, nível via `LOG_LEVEL`, `pino-pretty` só com `NODE_ENV=dev`.
2. **Reescrever [debugger.js](../src/app/util/debugger.js) por cima do Pino, mantendo os mesmos exports** (`serverInfo`, `serverError`, `cacheError`, `databaseError`). É a mesma estratégia do `HttpClient` do `stats-api` (contrato preservado): nenhum ponto de chamada precisa mudar.
3. **Trocar o `morgan` pelo `pino-http`**, com o `attachUid` movido para **antes** dele e `genReqId: (req) => req.uid`. Assim o log de acesso passa a ter status, duração e o mesmo `uid` usado como `correlationId` na fila. *(Confirmar com a infra se algo faz parse do formato atual do morgan.)*
4. **Substituir os `console.*`** de [textTranslator.js](../src/app/translator/textTranslator.js), [translationCache.js](../src/app/middlewares/translationCache.js) e [queueConnection.js](../src/app/util/queueConnection.js) por `logger.child({ uid })`.
5. **Segurança — corrigir junto com a migração** (exceção à regra da seção 9, por serem vazamentos):
   - [queueConnection.js:17](../src/app/util/queueConnection.js#L17) imprime o `connectionURL` inteiro, **com a senha do RabbitMQ**.
   - [sentimentAnalyzer.js:79](../src/app/util/sentimentAnalyzer.js#L79) imprime a resposta inteira da DeepSeek (`"UUUU"`).
   - O `pino-http` registra headers por padrão: usar `redact: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers.cookie']` — é por esses headers que a API key trafega.
   - Nunca registrar `req.body.text` (texto do usuário — LGPD).
6. **Correlação com trace.** A `@opentelemetry/instrumentation-pino` injeta `trace_id`/`span_id` nos logs, desde que o tracing seja carregado antes do logger (garantido pelo `--import`).

## 5. Etapa 2 — Métricas próprias (Prometheus)

### 5.1. Onde expor

| Opção | Prós | Contras |
|---|---|---|
| **A. Rota `GET /metrics/observability` no próprio Express** | Mesmo padrão do `stats-api`; reaproveita o `apiKeyAuth` existente | Fica atrás do rate limit geral e do CORS da aplicação (inofensivo para o Prometheus, mas convém isentar) |
| B. Servidor HTTP separado numa porta interna (ex.: `9464`) | Isolado do tráfego público e do rate limit | Precisa expor porta extra no Deployment/Service — o chart hoje expõe só `http` |

**Recomendação: opção A.** Diferente do dicionário, aqui não há NGINX público na frente nem catch-all de rotas, e o `apiKeyAuth` já protege as rotas operacionais. Registrar com rota explícita (`app.get('/metrics/observability', apiKeyAuth, handler)`) antes do 404 em [app.js:90](../src/app/app.js#L90), servindo um `observabilityRegistry` em formato **OpenMetrics**:

```js
// src/app/observability/selfMetrics.js
import client from 'prom-client';
export const observabilityRegistry = new client.Registry(client.openMetricsContentType);
client.collectDefaultMetrics({ prefix: 'translator_api_', register: observabilityRegistry });
```

### 5.2. Métricas propostas

Prefixo `translator_api_` (equivalente ao `stats_api_`).

**HTTP (equivalente direto do `stats-api`)**

| Métrica | Tipo | Labels | Onde alimentar |
|---|---|---|---|
| `translator_api_http_requests_total` | Counter | `method`, `route`, `status_code` | Novo middleware global, registrado **antes** do `translationCache` (que responde direto no cache hit) |
| `translator_api_http_request_duration_seconds` | Histogram (com exemplar) | idem | idem |

Para `route`, usar `req.route?.path ?? 'unmatched'`. Buckets até ~30s (o timeout da tradução). `res.on('finish')` também dispara quando a resposta sai de dentro do callback do `consume`, então a duração medida é a real.

**Específicas do tradutor (o que o `stats-api` não tem)**

| Métrica | Tipo | Labels | Motivo |
|---|---|---|---|
| `translator_api_rpc_requests_total` | Counter | `queue`, `outcome` = `success` / `timeout` / `worker_error` / `no_consumer` / `wrong_correlation` | Hoje o resultado do RPC só existe em log |
| `translator_api_rpc_duration_seconds` | Histogram | `queue`, `outcome` | Tempo real de tradução no worker. Buckets de 0,1s a 30s |
| `translator_api_queue_consumers` | Gauge | `queue` | Valor do `consumerCount`, que já é lido em toda requisição. **A métrica mais útil do tradutor**: `== 0` significa workers fora e toda tradução falhando — o papel do `services_up` do `stats-api` |
| `translator_api_cache_lookups_total` | Counter | `result` = `hit` / `miss` / `error` | Taxa de acerto do Redis ([translationCache.js](../src/app/middlewares/translationCache.js)) |
| `translator_api_sentiment_requests_total` | Counter | `status` | Chamadas à DeepSeek |
| `translator_api_sentiment_request_duration_seconds` | Histogram | — | idem — a análise faz N+1 chamadas sequenciais por requisição (seção 9) |
| `translator_api_gloss_refinement_total` | Counter | `outcome` = `refined` / `fallback` / `disabled` | O fallback para a glosa base hoje é silencioso (só `logger.warn`) |
| `translator_api_db_errors_total` | Counter | `operation` = `store_stats` / `save_translation` | Os `catch` que hoje só registram o erro |

**Runtime do Node** — `collectDefaultMetrics({ prefix: 'translator_api_', register: observabilityRegistry })`, igual ao `stats-api`.

### 5.3. Recomendado antes de instrumentar o RPC

Migrar `textTranslator`, `sentimentTranslator` e `textTranslatorHealth` para o `requestQueueReply` (seção 3, item 3) — equivalente à troca `GetDataApiService` → `HttpClient` no `stats-api`. Com isso, métricas e span do RPC ficam num ponto só. Fazer com os testes existentes passando antes de adicionar as métricas.

### 5.4. O que **não** fazer

- Não tocar na rota `/metrics` atual — o contrato é consumido pelo `stats-api`.
- Não colocar `uid`, `text`, `textHash` ou IP como label — cardinalidade ilimitada (e dado de usuário).

## 6. Etapa 3 — Tracing distribuído (OpenTelemetry)

### 6.1. Carregamento em ESM (a armadilha nº 1 deste serviço)

- O entrypoint de produção é `node bootstrap.js` ([Dockerfile:33](../Dockerfile#L33)), que roda as migrations e depois faz `import('./src/index.js')`.
- O jeito suportado é `node --import ./src/instrumentation.js bootstrap.js`, com `instrumentation.js` registrando o hook (`module.register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)`) e iniciando o `NodeSDK`.
- **Não usar `NODE_OPTIONS`**: o [bootstrap.js](../bootstrap.js) roda o `sequelize-cli db:migrate` como processo filho com `env: process.env`, e o processo de migration também carregaria o tracing.
- Ajustar também `npm start` e `npm run dev` (`nodemon --exec "node --import ./src/instrumentation.js src/index.js"`). Diferente do dicionário (`node ace serve --hmr`), aqui o modo dev aceita o `--import` sem dificuldade.

```js
// src/instrumentation.js (esqueleto)
import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
// ... express, pg, ioredis, amqplib, undici, pino

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

const sdk = new NodeSDK({
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => req.url?.startsWith('/metrics/observability'),
    }),
    /* ... */
  ],
});
sdk.start();
process.on('SIGTERM', () => sdk.shutdown()); // flush do batch quando o pod é encerrado
```

### 6.2. Instrumentações a habilitar

Importar **pacotes individuais**, em vez do `auto-instrumentations-node` com ~33 desligadas — evita o problema de boot de ~30s desde o início.

| Instrumentação | Por quê |
|---|---|
| `http` | HTTP de entrada; propagação `traceparent` |
| `express` | Nome de rota nos spans (no dicionário isso exigia trabalho manual; aqui é automático) |
| `pg` | Um span por query do Sequelize |
| `ioredis` | GET/SET do cache de traduções |
| `amqplib` | Publish/consume no RabbitMQ — injeta `traceparent` nos headers das mensagens |
| `undici` | `fetch` nativo para a DeepSeek |
| `pino` | Correlação `trace_id`/`span_id` nos logs |

### 6.3. Pontos de atenção próprios do tradutor

1. **Respostas do RabbitMQ podem virar traces órfãos.** A `instrumentation-amqplib` cria o span de consume usando como pai o contexto que vem **nos headers da mensagem**. A resposta do worker não traz `traceparent`, então o callback do `consume` (onde ficam `res.send`, `redis.set` e `translation.save`) pode cair num **trace novo**, com logs carregando outro `trace_id`. *Validar localmente.* Se acontecer: guardar `context.active()` antes do `consume` e executar o corpo do callback dentro de `context.with(ctxSalvo, ...)` — bem mais simples depois da unificação da seção 5.3.
2. **Texto do usuário pode ir para o Tempo.** O Sequelize insere valores literais no SQL em alguns casos (ex.: `Hit.findOne({ where: { text } })` em [textTranslator.js:33](../src/app/translator/textTranslator.js#L33)), e a `instrumentation-pg` grava o SQL em `db.statement`. *Conferir nos spans*; se aparecer, truncar/remover com `requestHook` (LGPD).
3. **O `traceparent` vai para a DeepSeek.** A `instrumentation-undici` injeta o header em toda chamada de saída. Para não enviar IDs internos a terceiros, usar `ignoreRequestHook` ou desligar a propagação para `api.deepseek.com`.

### 6.4. Spans manuais que valem a pena

| Span | Onde |
|---|---|
| `translator.rpc` (atributos `messaging.destination`, `correlation_id`) | Em volta de publish → resposta; após a unificação, só em [amqpRpc.js](../src/app/translator/amqpRpc.js) |
| `translator.cache_lookup` (atributo `hit=true/false`) | [translationCache.js](../src/app/middlewares/translationCache.js) |
| `translator.store_stats` (raiz ou link) | `storeStats` ([textTranslator.js:27](../src/app/translator/textTranslator.js#L27)) — roda via `setTimeout` fora do fluxo da resposta |
| `translator.sentiment` → `deepseek.call` por sentença | [sentimentAnalyzer.js](../src/app/util/sentimentAnalyzer.js) |
| `translator.gloss_refinement` | [glossRefinement.js](../src/app/translator/glossRefinement.js) |

### 6.5. Configuração

Mesmas decisões do `stats-api`: exporter OTLP/HTTP para o Tempo compartilhado (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`), `BatchSpanProcessor`, `OTEL_SERVICE_NAME=vlibras-translator-api` e **o mesmo Tempo dos outros serviços**.

**Sampling:** com 6 réplicas e rate limit de 300 req/min por cliente, definir `OTEL_TRACES_SAMPLER=parentbased_traceidratio` com `OTEL_TRACES_SAMPLER_ARG=0.1` **desde o início**. Com `parentbased`, chamadas vindas do `stats-api` seguem a decisão de quem chamou.

### 6.6. Propagação

| Origem → destino | O que acontece |
|---|---|
| `stats-api` → tradutor (`GET /metrics`) | O `stats-api` já envia `traceparent`; com a instrumentação `http` de entrada aqui, os traces se juntam automaticamente |
| tradutor → worker (fila `translate.to_text4`) | A `instrumentation-amqplib` injeta `traceparent` nos headers da mensagem. **Só vira um trace único quando o worker extrair esse header** — depende de outro time/serviço |
| worker → tradutor (resposta em `reply-to`) | Sem header de contexto hoje (ver 6.3, item 1). Se o worker copiar o contexto para a resposta, o problema desaparece |
| Player/cliente → tradutor | Sem `traceparent`; o tradutor inicia o trace |

Diferente do dicionário (cache → central dentro do mesmo repositório), **a propagação só é validável localmente com o `stats-api`** — a parte da fila depende do worker.

## 7. Etapa 4 — Exemplars

Igual ao `stats-api`, só no `translator_api_http_request_duration_seconds`:
- Instalar `prom-client` 15.x — o projeto não tem nenhuma versão hoje, então não há o problema da v12.
- `observabilityRegistry` em OpenMetrics.
- Checar `span.isRecording()` antes de anexar o `trace_id` — **obrigatório desde o primeiro dia**, porque o sampling já começa em 10%.
- Prometheus com `--enable-feature=exemplar-storage`.
- Segunda etapa: `translator_api_rpc_duration_seconds` é bom candidato a exemplar.

## 8. Deploy (Helm / Prometheus)

1. **Scrape por pod, não por Service.** Com 6 réplicas, raspar pelo Service cai num pod aleatório a cada scrape e mistura séries. Usar `kubernetes_sd_configs` com `role: pod` no namespace `vlibras` (ou `PodMonitor`, se a infra usar o Prometheus Operator). Exige RBAC do Prometheus para listar pods.
2. **Autenticação no scrape.** O bypass interno ([values.yaml](../deploy/helm/values.yaml), `INTERNAL_AUTH_BYPASS_HOSTS`) filtra pelo header `Host`; no scrape por IP do pod o host é o IP, que não está na lista. O `apiKeyAuth` já aceita `Authorization: ApiKey <token>`, que é exatamente o que o bloco `authorization` do Prometheus envia:
   ```yaml
   authorization:
     type: ApiKey
     credentials_file: /etc/prometheus/secrets/tradapi-key
   ```
3. **Quem raspa?** Este repositório não tem Prometheus no Helm. O job pode ir no `prometheus-configmap.yaml` do `stats-api` ou ficar com o time de infra. Decidir com o tech lead.
4. **Intervalo de scrape:** não herdar os `600s` do job do `stats-api` — com esse intervalo, `rate(...[5m])` não retorna nada. Sugerir 30–60s.
5. **Variáveis de ambiente novas** no `appConfig`: `LOG_LEVEL`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`; e o `CMD` do [Dockerfile](../Dockerfile) com `--import`.
6. **Ambiente local:** copiar `tempo`, `prometheus`, `grafana` e a pasta `observability/` do `stats-api` para o [docker-compose.yml](../docker-compose.yml), com uma rede `observability-net` ligando a API aos três (o compose atual isola tudo em redes por dependência). Manter `--enable-feature=exemplar-storage` e `0.0.0.0:4318` no Tempo.
7. **Dashboard:** `deploy/helm/dashboards/observabilidade-tradutor.json`, no padrão do `observabilidade-vlibras.json`, com painéis de RPC por `outcome`, `queue_consumers`, taxa de cache hit, latência p95 por rota e runtime do Node.

## 9. Problemas encontrados no código durante o estudo

Não são de observabilidade, mas vão aparecer nas métricas/traces assim que elas existirem. Melhor saber antes:

| # | Problema | Onde | Impacto provável |
|---|---|---|---|
| 1 | **Senha do RabbitMQ no log** e resposta completa da DeepSeek no log | [queueConnection.js:17](../src/app/util/queueConnection.js#L17), [sentimentAnalyzer.js:79](../src/app/util/sentimentAnalyzer.js#L79) | Vazamento de credencial. **Única exceção**: corrigir junto com a etapa 1 |
| 2 | **`nack` em consumer com `noAck: true`** quando o `correlationId` não bate | [textTranslator.js:337](../src/app/translator/textTranslator.js#L337) | Pelo protocolo AMQP, provavelmente fecha o canal com `PRECONDITION_FAILED` (delivery tag desconhecida). Raro com direct reply-to, mas vale confirmar |
| 3 | **RPC duplicado em quatro lugares**, cada um com seu tratamento de timeout e fechamento de canal | [textTranslator.js](../src/app/translator/textTranslator.js), [amqpRpc.js](../src/app/translator/amqpRpc.js) | Comportamento diferente por rota; o timer de 30s de `textTranslator` nunca é cancelado no sucesso ([textTranslator.js:234](../src/app/translator/textTranslator.js#L234)) |
| 4 | **Um canal AMQP novo por requisição** | idem | Churn de canais no RabbitMQ; o tracing vai mostrar o custo |
| 5 | **Incremento de hits com leitura-modificação-escrita** (`findOne` + `hits + 1` + `save`), com 6 réplicas | [textTranslator.js:27-56](../src/app/translator/textTranslator.js#L27-L56) | Contagens perdidas sob concorrência — afeta o ranking do `/metrics` JSON |
| 6 | **Análise de sentimento faz N+1 chamadas sequenciais à DeepSeek, sem timeout no `fetch`** | [sentimentAnalyzer.js:108](../src/app/util/sentimentAnalyzer.js#L108), [sentimentAnalyzer.js:123](../src/app/util/sentimentAnalyzer.js#L123) | Textos longos estouram os 30s; o cliente recebe 408 enquanto as chamadas continuam rodando |
| 7 | **Query de top hits agrega a tabela inteira** sem filtro de data, a cada chamada do `/metrics` | [metrics.js:41](../src/app/metrics/metrics.js#L41) | Custo cresce com o volume de `Hit`; o span de `pg` vai deixar isso evidente |
| 8 | **Log de debug ligado em produção** (`ENV DEBUG=vlibras-translator-*:*`) e log "Reutilizando conexão existente" a cada requisição | [Dockerfile:28](../Dockerfile#L28), [queueConnection.js:30](../src/app/util/queueConnection.js#L30) | Volume de log alto |

Recomendo registrar os itens 2 a 8 separadamente e **não** corrigir dentro da tarefa de observabilidade — assim as métricas novas mostram o "antes" e servem para medir o efeito da correção depois. A unificação do RPC (item 3) é a exceção opcional, por facilitar a instrumentação (seção 5.3).

## 10. Plano de execução e checklist

Mesma ordem do guia: logs → métricas → tracing → exemplars.

**Etapa 1 — Logs**
- [ ] `logger.js` com Pino, campos base e `LOG_LEVEL`
- [ ] [debugger.js](../src/app/util/debugger.js) reimplementado sobre o Pino, mesma API
- [ ] `pino-http` no lugar do `morgan`, com `attachUid` antes e `redact` de headers
- [ ] `console.*` → `logger.child({ uid })`
- [ ] Remover o log da senha do RabbitMQ e o `"UUUU"` da DeepSeek

**Etapa 2 — Métricas**
- [ ] (Recomendado) Unificar o RPC no `requestQueueReply`, com testes passando
- [ ] `prom-client` 15.x + `observabilityRegistry` (OpenMetrics) + `GET /metrics/observability`
- [ ] Middleware HTTP antes do `translationCache`
- [ ] Métricas de RPC, `queue_consumers`, cache, sentimento, refinamento e erros de DB
- [ ] `collectDefaultMetrics`
- [ ] Validar local via Docker, com o `/metrics` JSON intocado

**Etapa 3 — Tracing**
- [ ] `src/instrumentation.js` com as 7 instrumentações e `BatchSpanProcessor`
- [ ] `--import` no `Dockerfile`, `npm start` e `npm run dev` (sem `NODE_OPTIONS`)
- [ ] Medir o tempo de boot antes/depois
- [ ] Spans manuais (seção 6.4)
- [ ] Sampling definido desde o início
- [ ] Tempo, Prometheus e Grafana no [docker-compose.yml](../docker-compose.yml) local
- [ ] Validar spans órfãos no consume e `db.statement` com texto do usuário
- [ ] Bloquear a propagação para a DeepSeek
- [ ] Validar propagação: chamada do `stats-api` ao `/metrics` com o mesmo `trace_id` nos dois lados
- [ ] Validar `trace_id` nos logs

**Etapa 4 — Exemplars**
- [ ] `enableExemplars` no histograma HTTP + checagem de `isRecording()`
- [ ] Validar no Grafana local (clique no ponto → trace no Tempo)

**Deploy**
- [ ] Job de scrape por pod, com `Authorization: ApiKey` e intervalo de 30–60s
- [ ] Variáveis OTel no `appConfig`, apontando para o mesmo Tempo do `stats-api`
- [ ] Confirmar que os pods alcançam o endpoint OTLP do Tempo
- [ ] Dashboard

## 11. Pontos a confirmar antes de começar

1. Qual a stack do worker que consome `translate.to_text4`, e se o time dele pode adotar OpenTelemetry (extrair `traceparent` dos headers e, de preferência, devolvê-lo na resposta).
2. Quem configura o scrape em produção (job no Helm do `stats-api` ou time de infra), se o cluster usa Prometheus Operator (`PodMonitor`) ou config estática, e se o Prometheus tem RBAC para descobrir pods.
3. Se o Tempo compartilhado já está no ar, qual o endpoint OTLP e se os pods do tradutor conseguem alcançá-lo (rede/namespace).
4. Se algo na infra faz parse do formato de log do `morgan` (impacta a troca pelo `pino-http`).
5. Se `/translatesentiment` e `/refine` são usados em produção (`GLOSS_REFINEMENT_ENABLED: 'false'` no Helm) — define a prioridade das métricas de sentimento e refinamento.
6. Taxa de sampling aceitável, considerando 6 réplicas.
7. Se os problemas da seção 9 entram como tarefas separadas, e se a unificação do RPC entra nesta tarefa.
