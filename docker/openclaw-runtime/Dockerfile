ARG OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:latest
FROM ${OPENCLAW_BASE_IMAGE}

LABEL org.opencontainers.image.title="lobster-park-openclaw-runtime"
LABEL org.opencontainers.image.description="Platform-approved OpenClaw runtime image for Lobster Park"
LABEL org.opencontainers.image.vendor="Lobster Park"

USER root
WORKDIR /opt/lobster-park/openclaw-runtime

COPY docker/openclaw-runtime/approved-plugins.txt ./approved-plugins.txt
COPY docker/openclaw-runtime/runtime-info.sh /usr/local/bin/lobster-openclaw-runtime-info
RUN chmod +x /usr/local/bin/lobster-openclaw-runtime-info

ENV LOBSTER_OPENCLAW_APPROVED_PLUGINS_FILE=/opt/lobster-park/openclaw-runtime/approved-plugins.txt
ENV LOBSTER_OPENCLAW_RUNTIME_FLAVOR=platform-approved

USER node
