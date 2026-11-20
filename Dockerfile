# ── SIPREL — image produksi ──────────────────────────────────────────────
FROM node:24-alpine

# Metadata
LABEL org.opencontainers.image.title="SIPREL Elektro" \
      org.opencontainers.image.description="Sistem Informasi Persuratan Jurusan Teknik Elektro FT UNCEN" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app

# Aplikasi tidak memakai dependensi npm (Node.js + SQLite bawaan Node 24)
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY data/arsip.json ./data/arsip.json

RUN mkdir -p /data && addgroup -S siprel && adduser -S siprel -G siprel \
    && chown -R siprel:siprel /app /data
USER siprel

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=6s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
