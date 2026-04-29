# POC — Pipeline de reconhecimento

Valida que `InsightFace + Qdrant` funcionam ponta a ponta antes de tocar em UI/API.

## Pré-requisitos

```bash
docker compose up -d qdrant
cd apps/recognition
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Rodar

```bash
# 1. Coloque algumas fotos suas em poc/samples/ (jpg/png/jpeg)
mkdir -p poc/samples
cp ~/Downloads/foto1.jpg poc/samples/

# 2. Rode o POC
python poc/recognition_poc.py

# 3. (opcional) Stress test com galeria sintética de 10k embeddings
python poc/recognition_poc.py --gallery 10000 --skip-real
```

## O que medir

- **Top-1 accuracy** do auto-match (deve ser 100% — cada foto bate com ela mesma).
- **Latência de search** com 10k embeddings — deve ficar < 50ms p95 em CPU.
- **Latência de detect+embed** (depende do hardware; ~150–400ms em CPU para 1080p).

Se algo aqui falhar, paramos e ajustamos antes de seguir para UI.
