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
