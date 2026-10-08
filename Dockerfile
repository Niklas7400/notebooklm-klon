# Mehrstufiger Build fuer das Next.js-Standalone-Bundle (siehe next.config.ts
# "output: standalone"). Alle env-Variablen (siehe .env.example) sind reiner
# Server-Runtime-Zugriff -- keine davon wird im Client-Bundle inlined (auch
# nicht die NEXT_PUBLIC_*-Variablen, siehe README "Mit Docker starten"),
# deshalb reichen sie zur Laufzeit (docker run/compose --env-file), es
# braucht keine Build-Args.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .env.local wird per .dockerignore ausgeschlossen -- der Build braucht keine
# echten Keys, "next build" liest process.env nur zur Laufzeit aus.
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
