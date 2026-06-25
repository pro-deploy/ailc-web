# syntax=docker/dockerfile:1
#
# ailc как MCP-сервер в контейнере (канал «без Node.js»).
#
# Образ НЕ собирает Rust. Он скачивает уже готовый бинарь нужной архитектуры из
# релиза на GitHub, ровно как это делают обёртка npx и установочные скрипты. Это и
# есть «уже развёрнутый бинарь»: пользователю не нужно ничего компилировать.
#
# Назначение: ЛОКАЛЬНЫЙ запуск рядом с проектом. Папка проекта монтируется в /work,
# и сервер видит её файлы. Облачный запуск без монтирования файлов проекта не видит
# (протокол MCP файловую систему не передаёт), поэтому для проверки своего кода образ
# запускают у себя на машине.
#
# Сборка:   docker build -t ghcr.io/pro-deploy/ailc:0.4.0 .
# Запуск:   docker run -i --rm -v "$PWD:/work" -w /work ghcr.io/pro-deploy/ailc serve

FROM ubuntu:24.04

# Версию бинаря и репозиторий можно переопределить при сборке.
ARG AILC_VERSION=0.4.1
ARG REPO=pro-deploy/ailc
# Docker подставляет TARGETARCH автоматически (amd64 | arm64).
ARG TARGETARCH

LABEL org.opencontainers.image.title="ailc" \
      org.opencontainers.image.description="ailc (AI Life Cycle): автономный гейт качества и безопасности кода как MCP-сервер" \
      org.opencontainers.image.source="https://github.com/pro-deploy/ailc" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${AILC_VERSION}"

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tar git \
 && rm -rf /var/lib/apt/lists/*

# Скачиваем и распаковываем готовый бинарь нужной архитектуры из релиза.
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) triple="x86_64-unknown-linux-gnu" ;; \
      arm64) triple="aarch64-unknown-linux-gnu" ;; \
      *) echo "неподдерживаемая архитектура: ${TARGETARCH:-неизвестна}" >&2; exit 1 ;; \
    esac; \
    if [ "${AILC_VERSION}" = "latest" ]; then \
      url="https://github.com/${REPO}/releases/latest/download/ailc-${triple}.tar.gz"; \
    else \
      url="https://github.com/${REPO}/releases/download/v${AILC_VERSION}/ailc-${triple}.tar.gz"; \
    fi; \
    echo "Скачиваю ${url}"; \
    curl -fSL "${url}" -o /tmp/ailc.tar.gz; \
    tar -xzf /tmp/ailc.tar.gz -C /usr/local/bin ailc; \
    chmod +x /usr/local/bin/ailc; \
    rm /tmp/ailc.tar.gz; \
    test -x /usr/local/bin/ailc

# Непривилегированный пользователь. Папка проекта монтируется в /work.
RUN useradd -m -u 10001 ailc
USER ailc
WORKDIR /work

# По умолчанию поднимается MCP-сервер поверх stdio. Можно передать и любую
# подкоманду: docker run --rm -v "$PWD:/work" ghcr.io/pro-deploy/ailc dod .
ENTRYPOINT ["ailc"]
CMD ["serve"]
