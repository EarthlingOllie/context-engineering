# Sandbox image for the dispatch evals. Built by Inspect from the compose file
# the task writes. mirror.gcr.io avoids Docker Hub's anonymous pull limit.
# Python (for the Python fixture's pytest) is the base; Node 22 (for the
# harness and the Agent SDK) is copied in from the official Node image, since
# the build may not reach the Debian package mirrors.
FROM mirror.gcr.io/library/node:22-slim AS node

FROM mirror.gcr.io/library/python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && useradd --create-home --uid 1000 node
WORKDIR /opt/harness
COPY . /tmp/ctx/
# Optional: a proxy CA (git-ignored ca.crt) for build-time npm and pip installs behind a TLS-intercepting proxy.
RUN if [ -s /tmp/ctx/ca.crt ]; then npm config -g set cafile /tmp/ctx/ca.crt; fi && cp /tmp/ctx/package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force
RUN if [ -s /tmp/ctx/ca.crt ]; then export PIP_CERT=/tmp/ctx/ca.crt; fi \
 && pip install --no-cache-dir --disable-pip-version-check -r /tmp/ctx/requirements.txt
RUN mkdir -p /work /opt/plugin/workflows /opt/skills /opt/harness/src && chown -R node:node /work /opt/plugin /opt/skills /opt/harness
USER node
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    DISABLE_AUTOUPDATER=1 \
    NODE_PATH=/opt/harness/node_modules \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /work
CMD ["sleep", "infinity"]
