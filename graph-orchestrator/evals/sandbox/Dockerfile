# Sandbox image for the dispatch evals. Built by Inspect from the compose file
# the task writes. mirror.gcr.io avoids Docker Hub's anonymous pull limit.
FROM mirror.gcr.io/library/node:22-slim
WORKDIR /opt/harness
COPY . /tmp/ctx/
# Optional: a proxy CA (git-ignored ca.crt) for build-time npm install behind a TLS-intercepting proxy.
RUN if [ -s /tmp/ctx/ca.crt ]; then npm config -g set cafile /tmp/ctx/ca.crt; fi && cp /tmp/ctx/package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force
RUN mkdir -p /work /opt/plugin/workflows /opt/skills /opt/harness/src && chown -R node:node /work /opt/plugin /opt/skills /opt/harness
USER node
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    DISABLE_AUTOUPDATER=1 \
    NODE_PATH=/opt/harness/node_modules
WORKDIR /work
CMD ["sleep", "infinity"]
