# Sandbox image for the ticket-01 spike. Built by Inspect from compose.yaml.
# mirror.gcr.io avoids Docker Hub's anonymous pull limit (429 seen in cloud sessions).
FROM mirror.gcr.io/library/node:22-slim
# Optional: a proxy CA for build-time npm install behind a TLS-intercepting proxy.
# Put ca.crt in this directory (git-ignored); without it the build uses the public CAs.
WORKDIR /opt/harness
COPY . /tmp/ctx/
RUN if [ -s /tmp/ctx/ca.crt ]; then npm config -g set cafile /tmp/ctx/ca.crt; fi && cp /tmp/ctx/package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force
COPY harness.mjs ./
RUN mkdir -p /work /opt/plugin/workflows /opt/skills && chown -R node:node /work /opt/plugin /opt/skills
USER node
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    DISABLE_AUTOUPDATER=1 \
    NODE_PATH=/opt/harness/node_modules
WORKDIR /work
CMD ["sleep", "infinity"]
