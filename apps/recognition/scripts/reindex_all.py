"""Reindexa TODOS os participantes do banco no Qdrant usando o engine atual.

Uso típico: depois de trocar FACE_BACKEND (insightface <-> adaface), os vetores
existentes no Qdrant ficam inválidos (espaços diferentes). Este script:

1. Limpa a collection do Qdrant (recria).
2. Pega cada Photo do banco (via API NestJS).
3. Roda enroll usando o engine atual.

Uso:
    cd apps/recognition
    API_BASE=http://localhost:3006/api \\
    ADMIN_TOKEN=<jwt-admin> \\
    python scripts/reindex_all.py

(O Nest usa prefixo global /api; sem isso o script falha ao listar attendees.)

OBS: é ESSE script que você roda quando troca de backend, não o /enroll
público (que cria attendees do zero).
"""
from __future__ import annotations

import os
import sys
import time
from typing import Any

import requests

API_BASE = os.environ.get("API_BASE", "http://localhost:3006/api")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")
RECOGNITION_BASE = os.environ.get("RECOGNITION_BASE", "http://localhost:8000")


def _headers() -> dict[str, str]:
    if not ADMIN_TOKEN:
        print("ERRO: defina ADMIN_TOKEN (JWT do admin).", file=sys.stderr)
        sys.exit(1)
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


def list_pendentes_e_ativos() -> list[dict[str, Any]]:
    """Lista todos os participantes que têm pelo menos 1 foto."""
    r = requests.get(f"{API_BASE}/attendees", headers=_headers(), timeout=30)
    r.raise_for_status()
    items = r.json()
    return [it for it in items if it.get("status") != "DELETED"]


def baixar_foto_base64(attendee_id: str, ordem: int) -> str | None:
    r = requests.get(
        f"{API_BASE.rstrip('/')}/attendees/{attendee_id}/photos/{ordem}",
        headers=_headers(),
        timeout=30,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    import base64

    return base64.b64encode(r.content).decode("ascii")


def reindexar(attendee: dict[str, Any]) -> tuple[bool, str]:
    """Roda enroll no recognition para a foto 1 do participante."""
    try:
        b64 = baixar_foto_base64(attendee["id"], 1)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        return False, f"erro ao baixar foto ({code})"
    except requests.RequestException as e:
        return False, f"rede/API: {e!s}"

    if not b64:
        return False, "sem foto 1"

    payload = {
        "attendee_id": attendee["id"],
        "event_id": attendee["eventId"],
        "image_base64": b64,
    }
    r = requests.post(f"{RECOGNITION_BASE}/enroll", json=payload, timeout=60)
    if r.status_code != 200:
        return False, f"{r.status_code}: {r.text[:200]}"
    return True, "ok"


def main() -> int:
    print(f"API_BASE = {API_BASE}")
    print(f"RECOGNITION_BASE = {RECOGNITION_BASE}")

    print("\n[1/3] Aviso: este script NÃO limpa o Qdrant automaticamente.")
    print("      Recomendado: 'docker compose restart qdrant' antes, OU usar a")
    print("      flag --recreate da collection (use apenas se tiver certeza).")
    input("Pressione Enter para continuar (Ctrl+C cancela)...")

    print("\n[2/3] Listando participantes...")
    items = list_pendentes_e_ativos()
    print(f"      Total: {len(items)}")

    ok = 0
    fail = 0
    print("\n[3/3] Reindexando...")
    t0 = time.perf_counter()
    for i, att in enumerate(items, 1):
        success, reason = reindexar(att)
        flag = "OK " if success else "FAIL"
        print(f"  [{i}/{len(items)}] {flag} {att['id']} {att['nome']} - {reason}")
        if success:
            ok += 1
        else:
            fail += 1

    dt = time.perf_counter() - t0
    print(f"\nFeito em {dt:.1f}s — sucesso: {ok}, falha: {fail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
