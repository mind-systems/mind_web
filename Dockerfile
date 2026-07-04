# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" || \
    (echo "ERROR: VITE_API_BASE_URL build-arg is required" && exit 1)

# Optional — falls back to .env.production's committed defaults when omitted.
ARG VITE_OTLP_ENDPOINT
ARG VITE_OTLP_AUTH_TOKEN

RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Production stage
# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
