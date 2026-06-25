# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

ARG VITE_API_BASE_URL
# Fail fast: a missing build-arg would produce a broken bundle that only throws
# in the user's browser at runtime (the VITE_* value is inlined at build time).
RUN test -n "$VITE_API_BASE_URL" || \
    (echo "ERROR: VITE_API_BASE_URL build-arg is required" && exit 1)

# git + openssh-client are required for the private git+ssh observe-js
# dependency that npm ci clones over SSH.
RUN apk add --no-cache git openssh-client

WORKDIR /app

# Pre-populate known_hosts so the SSH clone of github.com doesn't prompt.
RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

# Install dependencies with BuildKit SSH agent forwarding so the private
# observe-js package can be cloned without embedding any secret in an image
# layer.  Build with:
#   DOCKER_BUILDKIT=1 docker build --ssh default --build-arg VITE_API_BASE_URL=... .
COPY package*.json ./
RUN --mount=type=ssh npm ci

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

# ---------------------------------------------------------------------------
# Fallback: PAT-secret install (no SSH agent available)
# ---------------------------------------------------------------------------
# If the host cannot forward an SSH agent (e.g. token-based CI), replace the
# SSH-based install above with:
#
#   RUN apk add --no-cache git
#   RUN --mount=type=secret,id=gh_token \
#       git config --global \
#         url."https://x-access-token:$(cat /run/secrets/gh_token)@github.com/".insteadOf \
#         "ssh://git@github.com/" \
#       && npm ci
#
# Build with:
#   DOCKER_BUILDKIT=1 docker build \
#     --secret id=gh_token,src=<path-to-token-file> \
#     --build-arg VITE_API_BASE_URL=... .
