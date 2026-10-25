# Multi-stage Dockerfile for Route Planning App
# -------------------------------------------------------------
# Stage 1: Base with Node.js and dependencies
# -------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# -------------------------------------------------------------
# Stage 2: Development environment (supports live HMR)
# -------------------------------------------------------------
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# -------------------------------------------------------------
# Stage 3: Production Build
# -------------------------------------------------------------
FROM base AS builder
RUN npm ci
COPY . .
# Default base path for Docker container serving is '/'
ENV BASE_PATH=/
RUN npm run build

# -------------------------------------------------------------
# Stage 4: Production Nginx Server
# -------------------------------------------------------------
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
