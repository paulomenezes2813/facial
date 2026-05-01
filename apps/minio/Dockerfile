# =============================================================================
# Wrapper para o MinIO no Railway.
# Necessário porque a CLI/UI do Railway tem quirks ao passar custom start
# command com aspas (`--console-address ":9001"` chega quebrado pro container),
# e RAILWAY_RUN_COMMAND não é respeitado pra serviços baseados em imagem pura.
# =============================================================================
FROM minio/minio:latest

# Persistência fica em /data — Railway monta o volume aqui.
EXPOSE 9000 9001

# `server` é o subcomando; entrypoint da imagem oficial já é o binário minio.
CMD ["server", "/data", "--console-address", ":9001"]
