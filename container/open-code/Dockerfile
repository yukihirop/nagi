# Nagi Agent Container (Open Code)
# Runs Open Code SDK in isolated Linux VM with browser automation

FROM node:22-slim

# Install system dependencies for Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    libdrm2 \
    libxshmfence1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python3 + Jupyter for notebook execution and HTML conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir --break-system-packages \
    jupyter \
    nbconvert \
    ipykernel \
    numpy \
    pandas \
    matplotlib \
    && python3 -m ipykernel install --name python3 --display-name "Python 3" \
    && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# Set Chromium path for browser automation
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install Open Code CLI (Go binary)
# TODO: Pin opencode CLI version and verify checksum for reproducible/secure builds
RUN curl -fsSL https://opencode.ai/install | bash \
    && find / -name opencode -type f 2>/dev/null -exec cp {} /usr/local/bin/opencode \; \
    && chmod +x /usr/local/bin/opencode \
    && opencode --version

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY host/agent-runner-opencode/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY host/agent-runner-opencode/src/ ./src/
COPY host/agent-runner-opencode/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Install MCP plugins
COPY container/plugins/mcp-ollama/package*.json /app/mcp-plugins/ollama/
RUN cd /app/mcp-plugins/ollama && npm install
COPY container/plugins/mcp-ollama/src/ /app/mcp-plugins/ollama/src/
COPY container/plugins/mcp-ollama/tsconfig.json /app/mcp-plugins/ollama/
RUN cd /app/mcp-plugins/ollama && npx tsc

COPY container/plugins/mcp-vercel/package*.json /app/mcp-plugins/vercel/
RUN cd /app/mcp-plugins/vercel && npm install
COPY container/plugins/mcp-vercel/src/ /app/mcp-plugins/vercel/src/
COPY container/plugins/mcp-vercel/tsconfig.json /app/mcp-plugins/vercel/
RUN cd /app/mcp-plugins/vercel && npx tsc

# Create workspace directories
RUN mkdir -p /workspace/group /workspace/global /workspace/extra /workspace/ipc/messages /workspace/ipc/tasks /workspace/ipc/input

# Create entrypoint script
RUN printf '#!/bin/bash\nset -e\ncd /app && npx tsc --outDir /tmp/dist 2>&1 >&2\nln -s /app/node_modules /tmp/dist/node_modules\nchmod -R a-w /tmp/dist\ncat > /tmp/input.json\nif [ -f /tmp/dist/entry.js ]; then\n  node /tmp/dist/entry.js < /tmp/input.json\nelse\n  node /tmp/dist/index.js < /tmp/input.json\nfi\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set ownership to node user (non-root) for writable directories
RUN chown -R node:node /workspace && chmod 777 /home/node

# Switch to non-root user
USER node

# Set working directory to group workspace
WORKDIR /workspace/group

# Entry point reads JSON from stdin, outputs JSON to stdout
ENTRYPOINT ["/app/entrypoint.sh"]
