# FlowAgent

> AI 驱动的业务翻译平台——将自然语言描述的业务场景，翻译为结构化的可执行流程蓝图。

---

## 项目简介

FlowAgent 解决「业务方说不清楚、技术方不知道做什么」的协作断层问题。  
业务方口述需求 → AI 生成可视化流程图 → 技术方在同一平台上审查确认，从周级缩短到小时级。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Standalone 模式) |
| UI | React 19 / Tailwind CSS 4 / shadcn/ui |
| 流程图 | @xyflow/react (React Flow) |
| 状态管理 | Zustand |
| 语言 | TypeScript 5 |
| 容器 | Docker (multi-stage build, linux/amd64) |
| 部署 | 火山引擎 VKE (Kubernetes) |

---

## 本地开发

### 环境要求

- Node.js >= 20
- npm >= 10

### 快速启动

```bash
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)，主入口文件为 `src/app/page.tsx`。

---

## 构建

### 普通构建（本地验证）

```bash
npm run build
npm run start
```

### CI 构建（带 CDN 静态资源前缀）

流水线中注入 `SCM_COMMIT_ID_SHORT` 变量，CDN 路径格式为  
`https://s1.nodesk.tech/pub/<commit-short-sha>/`

```bash
CDN_BASE_URL=https://s1.nodesk.tech/pub/${SCM_COMMIT_ID_SHORT}/ npm run build
```

> `CDN_BASE_URL` 在构建时通过 `next.config.ts` 的 `assetPrefix` 写入产物，  
> 运行时容器无需再注入该变量。

---

## Docker

### 本地构建（测试用）

```bash
npm run docker:build
# 等价于：
# docker build --platform linux/amd64 -t flow-chat .
```

### CI 构建 & 推送（火山引擎镜像仓库）

```bash
# 构建镜像（启用国内镜像加速 + 注入 CDN 前缀）
npm run docker:build:ci

# 推送到火山引擎镜像仓库
npm run docker:push:ci
```

镜像地址格式：

```
nodesk-center-cn-beijing.cr.volces.com/infra/flow-chat:<commit-short-sha>
```

> 以上两条命令依赖环境变量 `SCM_COMMIT_ID_SHORT`，由流水线自动注入。

---

## 部署（火山引擎）

### 架构概览

```
代码推送
  │
  ▼
流水线 (VCI Pipeline)
  ├─ npm run build:ci      # Next.js 构建，注入 CDN 前缀
  ├─ docker build:ci       # 多阶段 Docker 构建
  └─ docker push:ci        # 推送镜像到火山引擎镜像仓库
          │
          ▼
  镜像仓库 (nodesk-center-cn-beijing.cr.volces.com)
          │
          ▼
  VKE 集群 (cn-beijing) — Deployment: flow-chat
          │
          ▼
  私网访问：http://int-flow-chat.nodesk.tech
```

### 流水线

| 项目 | 说明 |
|------|------|
| 平台 | 火山引擎持续集成 (VCI) |
| 触发方式 | 代码推送自动触发 |
| 关键变量 | `SCM_COMMIT_ID_SHORT`（平台内置，commit 短 SHA） |
| 控制台 | [查看最新流水线记录](https://console.volcengine.com/cp/region:cp+cn-beijing/v2/workspace/89cb58d4bcb447dc9f868093205223dd/pipeline/683bfceaaca04bca91e4fa87b0ab7b4b/record/ac97b3cda1f34ee994388189bb50b581) |

### VKE 集群

| 项目 | 说明 |
|------|------|
| 集群区域 | 华北（北京） |
| 命名空间 | `test` |
| Deployment | `flow-chat` |
| 容器端口 | `3000` |
| 控制台 | [查看 Pod 详情](https://console.volcengine.com/vke/region:vke+cn-beijing/cluster/cd66r3dqifj5umpvroscg/deployment/test/flow-chat/detail?tab=overview) |

### 访问地址

| 环境 | 地址 |
|------|------|
| 内网 | http://int-flow-chat.nodesk.tech |

---

## 项目结构

```
flow-chat/
├── src/
│   ├── app/          # Next.js App Router 页面
│   ├── components/   # UI 组件
│   └── lib/          # 工具函数 / 业务逻辑
├── public/           # 静态资源
├── docs/             # 产品 & 架构文档
├── Dockerfile        # 多阶段构建配置
└── next.config.ts    # Next.js 配置（standalone + CDN）
```

---

## 常见问题

**Q: 本地 `npm run build` 和 CI 构建有什么区别？**  
A: CI 构建会通过 `--build-arg CDN_BASE_URL=...` 将静态资源上传前缀写入产物，本地构建默认使用相对路径，功能完全等价。

**Q: Docker 镜像为什么指定 `--platform linux/amd64`？**  
A: VKE 节点为 x86_64 架构，在 Apple Silicon (arm64) Mac 上构建时必须显式指定目标平台，否则镜像无法在集群中运行。

**Q: 容器以非 root 用户运行，有什么影响？**  
A: Dockerfile 中创建了 `nextjs` 系统用户（UID 1001），符合安全最佳实践。如需挂载 Volume，请确保宿主机目录权限匹配该 UID。
