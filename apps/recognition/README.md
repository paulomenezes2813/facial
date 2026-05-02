# Recognition Service

Microserviço Python que faz **detecção, embedding e busca** de rostos via InsightFace + Qdrant.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Healthcheck |
| POST | `/enroll` | Cadastra um rosto (foto base64) e indexa no Qdrant |
| POST | `/match` | Busca o rosto mais próximo dentro de um evento |
| DELETE | `/embeddings/{id}` | Remove um embedding específico |
| DELETE | `/events/{event_id}/embeddings` | Remove todos os embeddings de um evento (LGPD) |

## Rodar local (sem Docker)

```bash
cd apps/recognition
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Pré-requisito: Qdrant rodando (`docker compose up -d qdrant` no raiz).

## Rodar via Docker

```bash
# Build (demora alguns minutos na primeira vez por causa do download do modelo)
docker build -t facial-recognition apps/recognition

# Run (assumindo Qdrant rodando via docker-compose na rede facial-net)
docker run --rm -p 8000:8000 --network facial_facial-net \
  -e QDRANT_URL=http://qdrant:6333 \
  facial-recognition
```

## Notas sobre o modelo

- **Buffalo_L** = SCRFD (detector) + ArcFace R100 (embedding 512-dim).
- Primeira inicialização baixa ~280MB para `~/.insightface/models/`.
- `ctx_id=-1` força CPU. Para GPU NVIDIA, mude `INSIGHTFACE_CTX_ID=0` e instale `onnxruntime-gpu`.

## Backends de reconhecimento

A escolha do engine é feita por `FACE_BACKEND`:

| Valor | Detector | Embedding | Licença | Uso |
|---|---|---|---|---|
| `insightface` (default) | SCRFD | ArcFace R100 | **Não-comercial** | Dev / interno |
| `adaface` | MediaPipe BlazeFace | AdaFace IR-101 | MIT + Apache 2.0 | **Produção comercial** |

### Ativando o AdaFace

```bash
# 1) Instalar PyTorch só pra conversão (não usado em produção)
pip install torch

# 2) Baixar checkpoint oficial e converter pra ONNX (~250MB final)
python scripts/setup_adaface.py
# Saída: models/adaface_ir101_webface4m.onnx

# 3) Trocar o backend
export FACE_BACKEND=adaface

# 4) Reiniciar o serviço
uvicorn src.main:app --reload --port 8000
```

### IMPORTANTE: reindexação obrigatória ao trocar de backend

Embeddings de InsightFace e AdaFace vivem em **espaços vetoriais diferentes** —
um match contra vetores antigos sempre vai falhar. Ao trocar:

```bash
# Limpa a collection do Qdrant (reset completo)
docker compose restart qdrant

# Reindexa todos os participantes via API NestJS + recognition
ADMIN_TOKEN=<seu-jwt-admin> python scripts/reindex_all.py
```

Tempo estimado: ~200ms por participante em CPU, ~50ms em GPU.

### Recalibrar threshold ao usar AdaFace

O `MATCH_THRESHOLD=0.45` foi calibrado pra ArcFace. AdaFace tende a operar
melhor em **0.30–0.40**. Sugestão prática:

1. Cadastre 10–20 pessoas reais com fotos do C920s.
2. Faça 1 match com a mesma pessoa (positivo) e 1 match com pessoa diferente (negativo).
3. Olhe o `similarity` no log e escolha um threshold no meio dos dois clusters.
