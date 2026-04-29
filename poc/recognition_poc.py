"""POC standalone — valida o pipeline InsightFace → Qdrant.

O que ele faz:
  1. Carrega o modelo Buffalo_L (uma vez).
  2. Para cada imagem em ./poc/samples/ (ou cria sintéticas se vazio):
       - detecta rosto, gera embedding 512-dim
       - indexa no Qdrant com payload {attendee_id, event_id}
  3. Faz uma busca usando a 1ª foto como consulta e mede latência.
  4. Imprime relatório (precisão top-1, latência média/p95, tamanho da galeria).

Uso:
    python poc/recognition_poc.py
    python poc/recognition_poc.py --gallery 100   # cadastra 100 rostos sintéticos
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
import uuid
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps" / "recognition"))

from src.config import settings  # noqa: E402
from src.face_engine import FaceEngine  # noqa: E402
from src.vector_store import VectorStore  # noqa: E402

EVENT_ID = "00000000-0000-0000-0000-000000000001"


def synthesize_gallery(n: int) -> list[np.ndarray]:
    """Gera embeddings aleatórios L2-normalizados (estresse de busca, sem rosto real)."""
    rng = np.random.default_rng(42)
    out: list[np.ndarray] = []
    for _ in range(n):
        v = rng.standard_normal(settings.embedding_size).astype(np.float32)
        v /= np.linalg.norm(v)
        out.append(v)
    return out


def load_real_samples() -> list[Path]:
    samples_dir = ROOT / "poc" / "samples"
    if not samples_dir.exists():
        return []
    return sorted(
        [p for p in samples_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    )


def run_real_pipeline(samples: list[Path]) -> None:
    print(f"\n=== Pipeline real ({len(samples)} fotos) ===")
    engine = FaceEngine.get()
    store = VectorStore()

    enrolled: list[tuple[str, np.ndarray]] = []
    for path in samples:
        with path.open("rb") as f:
            import base64

            b64 = base64.b64encode(f.read()).decode()
        img = engine.decode_base64_image(b64)
        t0 = time.perf_counter()
        faces = engine.analyze(img)
        dt = (time.perf_counter() - t0) * 1000

        if not faces:
            print(f"  ✗ {path.name}: nenhum rosto detectado ({dt:.0f}ms)")
            continue
        if len(faces) > 1:
            print(f"  ⚠ {path.name}: {len(faces)} rostos detectados, usando o primeiro")

        face = faces[0]
        attendee_id = str(uuid.uuid4())
        embedding_id = str(uuid.uuid4())
        store.upsert(
            embedding_id,
            face.embedding,
            {"attendee_id": attendee_id, "event_id": EVENT_ID},
        )
        enrolled.append((attendee_id, face.embedding))
        print(f"  ✓ {path.name}: det_score={face.det_score:.3f} ({dt:.0f}ms)")

    if not enrolled:
        return

    # Auto-match: usa cada embedding cadastrado como consulta. Espera-se top-1 = ele mesmo.
    print("\n=== Auto-match (usa cada foto como consulta) ===")
    latencies: list[float] = []
    hits_correct = 0
    for attendee_id, emb in enrolled:
        t0 = time.perf_counter()
        results = store.search(emb, event_id=EVENT_ID, top_k=1)
        latencies.append((time.perf_counter() - t0) * 1000)
        if results and results[0].payload.get("attendee_id") == attendee_id:
            hits_correct += 1

    print(f"  Top-1 accuracy: {hits_correct}/{len(enrolled)}")
    print(
        f"  Latência search: avg={statistics.mean(latencies):.1f}ms "
        f"p95={statistics.quantiles(latencies, n=20)[-1] if len(latencies) >= 20 else max(latencies):.1f}ms"
    )


def run_synthetic_load(gallery_size: int) -> None:
    print(f"\n=== Carga sintética ({gallery_size} embeddings aleatórios) ===")
    store = VectorStore()
    embs = synthesize_gallery(gallery_size)

    t0 = time.perf_counter()
    for emb in embs:
        store.upsert(
            str(uuid.uuid4()),
            emb,
            {"attendee_id": str(uuid.uuid4()), "event_id": EVENT_ID + "-synth"},
        )
    enroll_total = (time.perf_counter() - t0) * 1000

    latencies: list[float] = []
    for emb in embs[:200]:  # 200 buscas
        t0 = time.perf_counter()
        store.search(emb, event_id=EVENT_ID + "-synth", top_k=1)
        latencies.append((time.perf_counter() - t0) * 1000)

    print(f"  Enroll {gallery_size} pontos: {enroll_total:.0f}ms ({enroll_total/gallery_size:.2f}ms/ponto)")
    print(
        f"  Search latência: avg={statistics.mean(latencies):.2f}ms "
        f"p95={statistics.quantiles(latencies, n=20)[-1] if len(latencies) >= 20 else max(latencies):.2f}ms"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gallery", type=int, default=0, help="Carga sintética com N embeddings")
    parser.add_argument("--skip-real", action="store_true", help="Pula o teste com fotos reais")
    args = parser.parse_args()

    if not args.skip_real:
        samples = load_real_samples()
        if samples:
            run_real_pipeline(samples)
        else:
            print(
                "Sem fotos em poc/samples/. Coloque .jpg/.jpeg/.png lá para testar o pipeline real."
            )

    if args.gallery > 0:
        run_synthetic_load(args.gallery)

    print("\n✓ POC concluído.")


if __name__ == "__main__":
    main()
