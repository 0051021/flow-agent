import type { NextConfig } from "next";

/**
 * Next.js 构建配置
 *
 * assetPrefix: 静态资源 CDN 前缀，通过环境变量 CDN_BASE_URL 注入。
 * - 本地开发 / 普通 build：环境变量不存在，回退到 undefined（等同默认 "/"）
 * - CI 构建（build:ci）：环境变量由脚本注入，指向 CDN 地址
 */
const nextConfig: NextConfig = {
  assetPrefix: process.env.CDN_BASE_URL || undefined,
};

export default nextConfig;
