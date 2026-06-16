FROM node:22-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ARG PRISMA_SCHEMA=prisma/schema.prisma
ENV PRISMA_SCHEMA=${PRISMA_SCHEMA}

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate --schema=${PRISMA_SCHEMA} && npm run build

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma db push --schema=${PRISMA_SCHEMA} && HOSTNAME=0.0.0.0 PORT=3000 npm run start"]
