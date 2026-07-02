FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/game-server/package.json ./packages/game-server/
RUN npm ci --workspace=packages/game-server
COPY packages/game-server ./packages/game-server
RUN npx tsc -p packages/game-server/tsconfig.json

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/game-server/dist ./packages/game-server/dist
COPY --from=builder /app/packages/game-server/package.json ./packages/game-server/

ENV NODE_ENV=production
ENV GAME_PORT=3002
EXPOSE 3002

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/game-server/dist/index.js"]
