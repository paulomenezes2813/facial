"""Baixa e converte o checkpoint AdaFace IR-101 (WebFace4M) para ONNX.

Uso:
    cd apps/recognition
    pip install torch  # só pra conversão; em produção não é necessário
    python scripts/setup_adaface.py

Saída: models/adaface_ir101_webface4m.onnx

Por que WebFace4M e não MS1MV2?
- WebFace4M tem origem mais defensável legalmente (MS-Celeb-1M foi retirado pela MS).
- A acurácia é comparável (às vezes melhor) ao IR-101 treinado em MS1MV2.

Repo oficial: https://github.com/mk-minchul/AdaFace (licença MIT)
Os pesos são baixados do release oficial do repo.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlretrieve

ROOT = Path(__file__).resolve().parents[1]  # apps/recognition
MODELS_DIR = ROOT / "models"
ADAFACE_REPO = "https://github.com/mk-minchul/AdaFace.git"
ADAFACE_REPO_REV = "master"

# IR-101 WebFace4M — o release GitHub v1 costuma 404; README oficial lista Google Drive.
# ID do ficheiro "R100 | WebFace4M" em https://github.com/mk-minchul/AdaFace#pretrained-models
CKPT_URLS = [
    "https://github.com/mk-minchul/AdaFace/releases/download/v1/adaface_ir101_webface4m.ckpt",
]
GDRIVE_CKPT_ID = "18jQkqB0avFqWa0Pas52g54xNshUOQJpQ"
CKPT_NAME = "adaface_ir101_webface4m.ckpt"
CKPT_CACHE = MODELS_DIR / CKPT_NAME
ONNX_OUT = MODELS_DIR / "adaface_ir101_webface4m.onnx"


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)


def _download(url: str, dst: Path) -> None:
    print(f"Baixando {url} -> {dst}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(url, dst)


def _ensure_gdown() -> None:
    try:
        import gdown  # noqa: F401
    except ImportError:
        print("Instalando gdown (fallback Google Drive)...")
        subprocess.run([sys.executable, "-m", "pip", "install", "gdown"], check=True)


def _download_checkpoint(dst: Path) -> None:
    """Tenta várias fontes até conseguir o .ckpt."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    last_err: Exception | None = None
    for url in CKPT_URLS:
        try:
            _download(url, dst)
            return
        except HTTPError as e:
            print(f"Aviso: falhou {url} ({e.code})")
            last_err = e
        except OSError as e:
            print(f"Aviso: falhou {url} ({e})")
            last_err = e
    # Fallback: Google Drive (mesmo checkpoint IR-101 WebFace4M do README)
    print(f"Tentando Google Drive (id={GDRIVE_CKPT_ID})...")
    _ensure_gdown()
    import gdown

    gdown.download(
        f"https://drive.google.com/uc?id={GDRIVE_CKPT_ID}",
        str(dst),
        quiet=False,
    )
    if not dst.exists() or dst.stat().st_size < 1_000_000:
        raise RuntimeError(
            "Download do checkpoint falhou (GitHub e Google Drive). "
            "Baixe manualmente o R100 WebFace4M do README do AdaFace e guarde como "
            f"{dst.name} em {dst.parent}, depois rode este script de novo."
        ) from last_err


def main() -> int:
    if ONNX_OUT.exists():
        print(f"OK: {ONNX_OUT} já existe. Apague o arquivo se quiser reconverter.")
        return 0

    try:
        import torch  # noqa: F401
    except ImportError:
        print(
            "ERRO: PyTorch não instalado. Rode `pip install torch` antes (só pra conversão).",
            file=sys.stderr,
        )
        return 1

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        repo_dir = tmpdir / "AdaFace"
        ckpt_path = tmpdir / CKPT_NAME

        # 1. Clona o repo oficial pra usar a definição de modelo (net.py).
        _run(["git", "clone", "--depth", "1", "--branch", ADAFACE_REPO_REV, ADAFACE_REPO, str(repo_dir)])

        # 2. Checkpoint: reutiliza cache em models/ se existir (evita ~683MB em retries).
        if CKPT_CACHE.exists() and CKPT_CACHE.stat().st_size >= 1_000_000:
            print(f"Reutilizando checkpoint em cache: {CKPT_CACHE}")
            shutil.copy2(CKPT_CACHE, ckpt_path)
        else:
            _download_checkpoint(ckpt_path)
            shutil.copy2(ckpt_path, CKPT_CACHE)

        # 3. Importa a definição do modelo do repo recém-clonado e converte.
        sys.path.insert(0, str(repo_dir))
        try:
            import net  # type: ignore
            import torch  # noqa: F811

            print("Carregando arquitetura ir_101...")
            model = net.build_model("ir_101")
            statedict = torch.load(str(ckpt_path), map_location="cpu")["state_dict"]
            model_statedict = {
                k[6:]: v for k, v in statedict.items() if k.startswith("model.")
            }
            model.load_state_dict(model_statedict)
            model.eval()

            dummy = torch.randn(1, 3, 112, 112)
            print(f"Exportando ONNX -> {ONNX_OUT}")
            torch.onnx.export(
                model,
                dummy,
                str(ONNX_OUT),
                input_names=["input"],
                output_names=["embedding", "norm"],
                dynamic_axes={"input": {0: "batch"}, "embedding": {0: "batch"}},
                # PyTorch recente exporta com opset ≥18; evita falhas na conversão para opset 13
                opset_version=18,
            )
        finally:
            sys.path.pop(0)

    print(f"OK: AdaFace ONNX exportado para {ONNX_OUT}")
    print("Próximo passo: defina FACE_BACKEND=adaface e reinicie o serviço.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
