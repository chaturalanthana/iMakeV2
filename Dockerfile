FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY --from=client /app/client/dist ./public
RUN npx prisma generate
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
