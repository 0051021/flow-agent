import type { NextConfig } from "next";

/**
 * Next.js 构建配置
 *
 * output: 'standalone' — 生成精简的独立运行目录，适合 Docker / K8s 部署。
 *   产物在 .next/standalone/，包含 server.js 和最小化的 node_modules。
 *
 * assetPrefix: 静态资源 CDN 前缀，通过环境变量 CDN_BASE_URL 注入。
 * - 本地开发 / 普通 build：环境变量不存在，回退到 undefined（等同默认 "/"）
 * - CI 构建：通过 Docker build-arg 或 shell 环境变量注入 CDN 地址
 */
const nextConfig: NextConfig = {
  output: "standalone",
  assetPrefix: process.env.CDN_BASE_URL || undefined,
};

export default nextConfig;
