# Multi-stage Dockerfile for Node.js + Express + TypeScript Backend

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/products uploads/print_documents

EXPOSE 8000

CMD ["node", "dist/server.js"]
