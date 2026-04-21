# ============================================================
# Multi-stage Dockerfile for Next.js standalone deployment
#
# Build args:
#   USE_CN_MIRROR  - 设为 "true" 启用火山云镜像加速（仅 CI 环境）
#   CDN_BASE_URL   - 静态资源 CDN 前缀（CI 构建时注入）
#
# 本地构建：docker build --platform linux/amd64 -t flow-chat .
# CI  构建：docker build --platform linux/amd64 \
#             --build-arg USE_CN_MIRROR=true \
#             --build-arg CDN_BASE_URL=https://s1.nodesk.tech/pub/<commit>/ \
#             -t flow-chat .
# ============================================================

# ---- Base image ----
FROM node:20-slim AS base

# ---- Install dependencies ----
FROM base AS deps
WORKDIR /app

ARG USE_CN_MIRROR="false"

# 火山云 apt 镜像（仅 CI 环境生效）
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      sed -i 's|deb.debian.org|mirrors.ivolces.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi

# 火山云 npm 镜像（仅 CI 环境生效）
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      npm config set registry https://registry.npmmirror.com; \
    fi

COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# CDN 静态资源前缀，构建时由 next.config.ts 读取
ARG CDN_BASE_URL=""
ENV CDN_BASE_URL=$CDN_BASE_URL

RUN npm run build

# ---- Production runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 非 root 用户运行，安全最佳实践
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 产物不包含 public 和 .next/static，需手动复制
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
