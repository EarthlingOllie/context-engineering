# Session-sandbox spike (observability-evals ticket 01). Built by Inspect from compose.yaml.
# Claude Code is pinned here and run in place by inspect_swe (version="sandbox").
# mirror.gcr.io avoids Docker Hub's anonymous pull limit.
FROM mirror.gcr.io/library/node:22-slim
ARG CLAUDE_CODE_VERSION=2.1.332
COPY . /tmp/ctx/
# Optional: a proxy CA (git-ignored ca.crt) for the build-time npm install behind a TLS-intercepting proxy.
RUN if [ -s /tmp/ctx/ca.crt ]; then npm config -g set cafile /tmp/ctx/ca.crt; fi \
 && npm install -g --no-audit --no-fund "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force
RUN mkdir -p /work /opt/repo && chown -R node:node /work /opt/repo
USER node
ENV DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
WORKDIR /work
CMD ["sleep", "infinity"]
