# Plano — Sistema de Credenciamento Facial para Eventos

## 0. Decisões confirmadas pelo cliente (2026-04-29)

- **Infraestrutura**: tudo roda na máquina local do Paulo (sem cloud por enquanto). Docker Compose para subir todos os serviços.
- **Totens no evento**: 1 unidade. A própria máquina de desenvolvimento atua como totem no primeiro evento.
- **Webcam**: **Logitech C920s Pro Full HD** (1080p, autofoco, microfone embutido) — alinhada com a recomendação. Sem depth/RealSense por ora; anti-spoofing 100% por software.
- **Painel administrativo**: construir do zero (sem integração com `appinstituto.com.br` neste momento).
- **DPO**: ainda será contratado — bloqueio para go-live em produção, **não** para o desenvolvimento.
- **Política de retenção**: **10 dias** após o evento. Job diário apaga fotos originais e embeddings.

## 1. Entendimento do produto (a partir das 5 telas)

App web mobile-first (`hubsaude.appinstituto.com.br`) que faz **pré-cadastro facial** dos participantes e, no dia do evento, faz **check-in por reconhecimento facial em totem na entrada**.

Fluxo capturado nas telas:

1. **Dados pessoais** — Nome, Sobrenome, CPF, Data de nascimento, Cargo
2. **Contato + LGPD** — E-mail, Celular, Município, consentimento explícito de uso da imagem
3. **Foto 1** — Selfie de frente, com guia oval e dicas (boa iluminação, sem óculos escuros, sem boné)
4. **Foto 2** — Leve ângulo (importante: melhora robustez do embedding em condições variadas no totem)
5. **Confirmação** — Protocolo único (`cmoiyjs71000d584kvhkxqrfo` no exemplo)

Decisões já alinhadas: totem na entrada, galeria média (1k–10k), stack Node/TypeScript com microserviço Python.

---

## 2. Comparativo das soluções de reconhecimento

| Critério | **NVIDIA DeepStream / Metropolis** | **Intelbras (Bio-T / catracas)** | **InsightFace (ArcFace) — open source** |
|---|---|---|---|
| Tipo | SDK de pipelines de vídeo em tempo real | Ecossistema fechado de hardware (catracas, terminais Bio-T) | Biblioteca open source de detecção + embedding |
| Modelo de reconhecimento | Você monta (FaceDetectIR + FaceNet + alinhamento) | Embarcado no equipamento (caixa-preta) | ArcFace SOTA pronto (Buffalo_L) |
| Hardware | Exige GPU NVIDIA ou Jetson | Catracas/terminais R$ 3k–15k cada | CPU funciona; GPU acelera (opcional) |
| Acesso à API/SDK | Aberto | **NDA obrigatório** via grupo.sdk@intelbras.com.br | MIT/Apache, sem burocracia |
| Caso de uso ideal | CFTV passivo com 16+ câmeras IP | Controle físico de acesso (catraca/porta) | App + totem com webcam |
| Curva de aprendizado | Alta (C++/Gstreamer) | Média (REST + manual proprietário) | Baixa (Python, exemplos prontos) |
| Custo de licenciamento | Free, mas exige hardware NVIDIA | Hardware obrigatório por ponto | Zero |
| Precisão (LFW / MegaFace) | Boa, depende do modelo plugado | Não publica benchmarks abertos | 99.83% LFW / SOTA MegaFace |
| Privacidade / LGPD | Você controla | Dado fica em equipamento de terceiro | Você controla 100% |

### Recomendação: **InsightFace** (Buffalo_L = SCRFD + ArcFace)

- DeepStream é overkill: foi feito para processar dezenas de streams de vídeo em paralelo, não para um totem com captura ativa.
- Intelbras só faz sentido se a entrada usar **catraca física Intelbras** — aí você usa o equipamento deles e integra via REST. Para totem com webcam, perde flexibilidade e adiciona dependência de fornecedor.
- InsightFace é o padrão de fato em produção, ONNX roda em qualquer hardware (Intel, ARM, Apple, NVIDIA), e para 10k embeddings a busca é trivial (<50ms em CPU com FAISS).

**Liveness / anti-spoofing** (necessário para evitar que alguém use foto impressa no totem): `Silent-Face-Anti-Spoofing` (MiniFASNet, open source) ou `MediaPipe Face Stylizer` para checagem de profundidade básica. Se o orçamento permitir webcam com depth (Intel RealSense D435), o anti-spoofing fica muito mais confiável.

---

## 3. Arquitetura proposta

```
┌──────────────────────┐         ┌──────────────────────────────────────┐
│ APP WEB (mobile)     │         │  CLOUD                                │
│ Next.js + TS + PWA   │ HTTPS   │  ┌───────────────┐  ┌──────────────┐ │
│ - Formulário         ├────────►│  │ API Node      │  │ PostgreSQL    │ │
│ - Câmera (oval)      │         │  │ (NestJS)      ├──┤ (dados +      │ │
│ - Validação client   │         │  └──────┬────────┘  │  protocolos)  │ │
│ - Consentimento LGPD │         │         │           └──────────────┘ │
└──────────────────────┘         │         │           ┌──────────────┐ │
                                 │         ├──────────►│ S3 / MinIO    │ │
                                 │         │           │ (fotos cifr.) │ │
                                 │         ▼           └──────────────┘ │
                                 │  ┌────────────────┐ ┌──────────────┐ │
                                 │  │ Microserviço   │ │ Qdrant       │ │
                                 │  │ Python/FastAPI ├─┤ (vetores     │ │
                                 │  │ InsightFace    │ │  ArcFace)    │ │
                                 │  └────────────────┘ └──────────────┘ │
                                 └────────────────┬─────────────────────┘
                                                  │ sync (galeria do evento)
                                                  ▼
                                 ┌──────────────────────────────────────┐
                                 │  TOTEM (no local do evento)          │
                                 │  Mini-PC + Webcam HD + Tela touch    │
                                 │  - Chromium kiosk / Electron         │
                                 │  - Cache local de embeddings (FAISS) │
                                 │  - Inferência local (ONNX Runtime)   │
                                 │  - Funciona offline                  │
                                 └──────────────────────────────────────┘
```

### Por que cloud para cadastro + on-prem para totem (híbrido)

- Cadastro acontece dias/semanas antes — escala elástica e backup automático compensa cloud.
- No dia do evento a internet do local pode falhar. O totem precisa funcionar **independente de rede**: galeria do evento (até 10k embeddings ≈ 20MB) é sincronizada antes e fica em cache local.
- Reconhecimento local também elimina latência (resposta sub-segundo).

---

## 4. Stack técnica detalhada

### Frontend de cadastro (mobile web)
- **Next.js 14 (App Router) + TypeScript**
- **Tailwind + shadcn/ui** (alinhado com o visual já existente nas telas)
- **react-hook-form + zod** para validação (CPF, e-mail, celular)
- **@mediapipe/face_detection** roda no browser para garantir antes do upload: rosto centralizado, único rosto, iluminação adequada
- PWA com manifest e service worker
- Acessibilidade (WCAG AA) — campos com label, contraste, navegação por teclado

### Backend principal (Node)
- **NestJS + TypeScript**
- **PostgreSQL 16 + Prisma** (dados pessoais cifrados em coluna com pgcrypto)
- **S3 (AWS) ou MinIO (on-prem)** para fotos originais (server-side encryption AES-256)
- **Redis** para sessões de cadastro e protocolos
- **BullMQ** fila para enviar fotos ao microserviço Python e indexar embeddings
- Auth admin: Auth.js + 2FA para painel de organizadores

### Microserviço de visão (Python)
- **FastAPI + Uvicorn**
- **InsightFace** modelo `buffalo_l` (SCRFD detector + ArcFace R100 embedding 512-dim)
- **ONNX Runtime** (CPU em dev, GPU CUDA em prod se necessário)
- **Silent-Face-Anti-Spoofing** para liveness
- **Qdrant** como vector DB (alternativa: pgvector se quiser unificar no Postgres)

### Aplicação do totem
- **Mini-PC**: Intel NUC i5 ou similar (R$ 3–5k), Linux Ubuntu LTS
- **Webcam**: Logitech C920/Brio (R$ 400–800) — adequada. Upgrade opcional: Intel RealSense D435 (R$ 2k) para depth e melhor anti-spoof
- **Tela**: 15" touch capacitiva (R$ 1.500–2.500)
- **Software**: Electron ou Chromium em modo kiosk apontando para PWA dedicada
- Sincroniza embeddings + nomes do evento ao iniciar (HTTPS + JWT)
- Pipeline local: captura → liveness → detecção/embedding → busca FAISS → resposta

### Painel admin (organizador do evento)
- Próprio Next.js (rota separada)
- Lista de cadastros, status (pré-cadastrado / check-in feito / no-show)
- Re-export de dados, QR de protocolo (fallback se o reconhecimento falhar)
- Gestão de eventos (cada totem é vinculado a um evento)

---

## 5. LGPD e segurança (mandatório, não opcional)

- Consentimento explícito já está na UI ✅
- **Finalidade limitada**: usar foto/embedding apenas para check-in daquele evento
- **Retenção mínima**: política automática para apagar fotos e embeddings em N dias após o evento (sugestão: 30 dias)
- **Direito ao esquecimento**: endpoint público com link via e-mail/protocolo para deletar dados
- **Criptografia**: TLS 1.3 em trânsito, AES-256 em repouso (S3 SSE + pgcrypto)
- **Logs de acesso** auditáveis a dados biométricos (LGPD Art. 11)
- **DPO designado** + RIPD (Relatório de Impacto à Proteção de Dados) documentada
- **Não compartilhar** dados biométricos com terceiros sob nenhuma circunstância
- **Hash do CPF** como identificador secundário (não armazenar CPF em claro fora da coluna cifrada)

---

## 6. Fases de execução

| Fase | Duração | Entregáveis |
|---|---|---|
| **0. Setup e arquitetura final** | 3–5 dias | Repos, CI/CD, docker-compose dev, infra-as-code (Terraform AWS), RIPD inicial |
| **1. Cadastro web (formulário + 1 foto)** | 1,5 sem | Telas 1, 2, 3 funcionais, upload S3, persistência PG |
| **2. Captura de 2 fotos + qualidade no client** | 0,5 sem | MediaPipe validando enquadramento, tela 4 (confirmação com protocolo) |
| **3. Microserviço de reconhecimento** | 2 sem | FastAPI + InsightFace + Qdrant; endpoints `enroll`, `match`, `delete`; testes |
| **4. Painel admin** | 1 sem | Listagem, busca por CPF/protocolo, exportação, gestão de eventos |
| **5. App do totem + sync offline** | 2 sem | Electron/PWA kiosk, sync de embeddings, inferência local, liveness |
| **6. Integração e2e + carga** | 1 sem | Teste com 10k cadastros sintéticos, 100 check-ins/min, fail-over |
| **7. Hardening LGPD + segurança** | 1 sem | Pen-test interno, criptografia validada, retenção automática, DPO docs |
| **8. Piloto em evento real (controlado)** | 1 sem | Evento até 500 pessoas, métricas de FAR/FRR, ajustes finos |

**Total**: ~10 semanas até produção piloto. Plano pode ser comprimido com 2 devs trabalhando em paralelo (web + Python).

---

## 7. Custos estimados (cenário confirmado)

| Item | Valor |
|---|---|
| Infraestrutura (rodando local) | **R$ 0** |
| Webcam Logitech C920s Pro | já em posse |
| Licenças de software | **R$ 0** (100% open source) |
| DPO (a contratar antes do go-live) | a definir |
| Domínio + certificado | já existe |

> Quando passarmos para produção real (cloud + N totens), revisamos os custos.

---

## 8. Skills, MCPs e agentes que vou usar na execução

- **Skill `pdf`** — para gerar documentação técnica (RIPD, manual do totem)
- **Skill `docx`** — para entregáveis formais ao cliente (proposta, contrato, manual de operação)
- **Skill `xlsx`** — relatórios de check-in pós-evento (cadastros vs. presentes, latência, falhas)
- **Agente `Plan`** — refinar arquitetura de cada microserviço antes de implementar
- **Agente `Explore`** — auditar código quando começarmos a integrar e crescer
- **Agente `general-purpose`** — pesquisas pontuais (ex: comparar Qdrant vs pgvector vs Milvus quando passarmos de 10k)
- **MCP registry** — verificar se há MCP para AWS/GCP/Hetzner para automação de deploys

---

## 9. Pendências (não bloqueiam dev, bloqueiam go-live)

1. Contratação do **DPO** + assinatura da RIPD antes de processar dados reais de participantes.
2. Decisão sobre **cloud provider** quando sair do localhost (AWS / Hetzner / on-prem dedicado).
3. Política formal escrita de retenção de **10 dias** + endpoint público de "direito ao esquecimento".

---

## 10. Próximo passo recomendado

Aprovado o plano, começamos pela **Fase 0**:

1. Criar estrutura monorepo em `/Users/paulomenezes/git/facial/`:
   - `apps/web` — Next.js (cadastro mobile + painel admin)
   - `apps/api` — NestJS (backend principal)
   - `apps/recognition` — FastAPI + InsightFace (microserviço Python)
   - `apps/totem` — PWA/Electron de check-in
   - `packages/shared` — tipos TS compartilhados
2. `docker-compose.yml` com **PostgreSQL 16, Redis, MinIO, Qdrant** rodando local.
3. POC isolado: cadastrar 100 rostos sintéticos no microserviço Python, fazer 100 buscas e medir latência média/p95.
4. Validar com **uma foto real sua** que o pipeline `enroll → match` funciona ponta a ponta antes de tocar em UI.

Estimativa Fase 0: **2–3 dias de trabalho**.
