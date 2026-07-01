FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend
COPY packages/backend ./packages/backend
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma && \
    npx tsc -p packages/backend/tsconfig.json

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/backend/dist/index.js"]
