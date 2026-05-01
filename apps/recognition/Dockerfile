FROM python:3.11-slim

# Dependências do sistema necessárias para opencv e insightface
# build-essential e cmake são pré-requisitos: insightface 0.7.3 não tem wheel
# para Python 3.11/Linux, precisa compilar extensões Cython na instalação.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pré-baixar o modelo Buffalo_L na build (evita download na primeira request)
RUN python -c "import insightface; insightface.app.FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1, det_size=(640, 640))"

COPY src ./src

EXPOSE 8000

# Railway injeta PORT dinamicamente; em local, cai no default 8000
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
