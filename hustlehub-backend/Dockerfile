
FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY src ./src

RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
