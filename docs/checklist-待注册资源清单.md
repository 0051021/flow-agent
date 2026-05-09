# GSDS 入库 — 待注册资源清单

> 业务翻译（阶段 1）已完成，IR 和 JobSpec 已生成。
> 以下是阶段 2 技术方需要在 task-platform 注册的所有资源，全部注册完毕后方可 validate → import → publish。

---

## 1. Skill（3 个）

### 1.1 `gsds-file-fetcher`
- **用途**：从 SharePoint 下载 PDF 文件到临时存储
- **类型**：integration
- **输入**：`sharepoint_file_url: string`
- **输出**：`pdf_file_path: string`, `file_name: string`
- **依赖 Tool**：`sharepoint-file-download`
- **依赖 Secret**：`sharepoint-api-credential`
- **开发量**：低（封装 SharePoint SDK 下载调用）
- **状态**：⬜ 未注册

### 1.2 `gsds-pdf-parser`
- **用途**：多模态解析 GSDS PDF，提取 BBN、PART、颜色、UN 编号、成分列表等全部字段
- **类型**：agentic
- **输入**：`pdf_file_path: string`（本地 PDF 路径）
- **输出**：符合 `gsds-parsed-record.schema.json` 的结构化 JSON
- **核心逻辑**：
  - 调用多模态模型（如 GPT-4o）读取 PDF 图像
  - 提取所有字段，部分字段不存在则不输出
  - BBN 和 PART 为必填，校验非空
  - 密度 = SDS密度四舍五入保留两位小数
  - 成分列表解析为 `[{component, content, cas}]` 数组
- **依赖 Tool**：无（Skill 内部直接调多模态 API）
- **开发量**：中（Prompt 工程 + 输出格式校验）
- **状态**：⬜ 未注册

### 1.3 `gsds-db-writer`
- **用途**：按 BBN+PART 唯一键做 UPSERT
- **类型**：integration
- **输入**：符合 `gsds-parsed-record.schema.json` 的结构化 JSON
- **输出**：`operation: "insert" | "update"`, `affected_rows: number`, `bbn: string`, `part: string`
- **核心逻辑（UPSERT）**：
  ```sql
  -- 伪 SQL，实际实现取决于数据库类型
  
  -- 方式 A：先查后写
  SELECT * FROM gsds_master WHERE bbn = ? AND part = ?;
  -- 如果查到 → UPDATE
  UPDATE gsds_master SET color=?, state=?, ... WHERE bbn=? AND part=?;
  -- 如果没查到 → INSERT
  INSERT INTO gsds_master (bbn, part, color, state, ...) VALUES (?, ?, ?, ?, ...);
  
  -- 方式 B：数据库原生 UPSERT（推荐）
  -- PostgreSQL:
  INSERT INTO gsds_master (bbn, part, color, state, ...)
  VALUES (?, ?, ?, ?, ...)
  ON CONFLICT (bbn, part)
  DO UPDATE SET color=EXCLUDED.color, state=EXCLUDED.state, ...;
  
  -- MySQL:
  INSERT INTO gsds_master (bbn, part, color, state, ...)
  VALUES (?, ?, ?, ?, ...)
  ON DUPLICATE KEY UPDATE color=VALUES(color), state=VALUES(state), ...;
  ```
- **写后读校验**：写入后按 BBN+PART 再查一次确认数据一致
- **依赖 Tool**：`gsds-db-upsert`
- **依赖 Secret**：`gsds-db-credential`
- **开发量**：低（标准 DB 操作）
- **状态**：⬜ 未注册

---

## 2. Tool（2 个）

### 2.1 `sharepoint-file-download`
- **用途**：封装 SharePoint REST API / Graph API 的文件下载能力
- **能力**：接收文件 URL，返回本地临时文件路径
- **认证方式**：Bearer Token（通过 Secret 注入）
- **注意事项**：需处理大文件流式下载、超时重试
- **状态**：⬜ 未注册

### 2.2 `gsds-db-upsert`
- **用途**：封装 GSDS 主数据库的连接和 UPSERT 操作
- **能力**：接收结构化记录，执行 INSERT 或 UPDATE
- **认证方式**：用户名密码（通过 Secret 注入）
- **注意事项**：连接池管理（上限 50）、事务隔离、写后读校验
- **状态**：⬜ 未注册

---

## 3. Secret（2 个）

### 3.1 `sharepoint-api-credential`
- **类型**：Bearer Token
- **用途**：SharePoint API 访问凭证
- **管理方式**：平台凭证管理器托管，定期轮换
- **状态**：⬜ 未录入

### 3.2 `gsds-db-credential`
- **类型**：用户名 + 密码
- **用途**：GSDS 主数据库连接凭证
- **管理方式**：平台凭证管理器托管
- **状态**：⬜ 未录入

---

## 4. ContextPolicy（1 个）

### 4.1 `gsds-processing-default`
- **用途**：定义 GSDS 流程中 Task 之间的上下文打包策略
- **推荐配置**：
  - node-1 → node-2：`last-output-only`（只传 PDF 路径）
  - node-2 → node-3：`last-output-only`（传解析结果供审核）
  - node-3 → node-4：`last-output-only`（只传审核确认后的记录）
- **状态**：⬜ 未注册

---

## 5. ContextSource（1 个）

### 5.1 `cs-gsds-master-db`
- **用途**：声明 GSDS 主库作为上下文数据源
- **sourceType**：`http`
- **sensitivity**：`confidential`
- **状态**：⬜ 未注册

---

## 6. Trigger（1 个）

### 6.1 `gsds-pdf-uploaded`
- **类型**：Webhook / 事件监听
- **触发条件**：用户在 SharePoint GSDS 目录上传 PDF 文件
- **传入参数**：`sharepoint_file_url`（上传文件的 URL）
- **实现方式**：
  - 方案 A：SharePoint Webhook → 平台 API endpoint
  - 方案 B：定时轮询 SharePoint 目录变更
- **状态**：⬜ 未注册

---

## 7. RuntimeProfile（3 个，可能已有）

| code | workerType | 是否通用 | 状态 |
|------|-----------|---------|------|
| `agentic-default` | llm | 是（平台通用） | ⬜ 确认是否已存在 |
| `integration-default` | http | 是（平台通用） | ⬜ 确认是否已存在 |
| `human-review-default` | human | 是（平台通用） | ⬜ 确认是否已存在 |

---

## 8. 数据库建表（前置条件）

GSDS 主库需要确保以下表结构和约束：

```sql
CREATE TABLE gsds_master (
  bbn              VARCHAR(50)   NOT NULL,
  part             VARCHAR(50)   NOT NULL,
  color            VARCHAR(100),
  state            VARCHAR(100),
  official_transport_name VARCHAR(200),
  un_number        VARCHAR(10),
  hazard_class     VARCHAR(10),
  packing_group    VARCHAR(10),
  flammable_liquid_category VARCHAR(50),
  metal_corrosion_category  VARCHAR(50),
  skin_corrosion_irritation_category VARCHAR(50),
  serious_eye_damage_category VARCHAR(50),
  skin_sensitization_category VARCHAR(50),
  aspiration_hazard_category  VARCHAR(50),
  aquatic_hazard_short_term   VARCHAR(50),
  aquatic_hazard_long_term    VARCHAR(50),
  marine_pollutant  VARCHAR(50),
  acute_toxicity    VARCHAR(50),
  sds_density       DECIMAL(10,4),
  density           DECIMAL(10,2),
  composition       JSON,          -- [{component, content, cas}]
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (bbn, part)
);
```

- **状态**：⬜ 确认表是否已存在

---

## 发布前检查清单

全部资源注册完毕后，执行以下命令：

```bash
API=http://localhost:3001/api

# 1. 校验 JobSpec
task-platform job validate gsds-ingest-jobspec.yaml --api "$API"

# 2. 导入（草稿）
task-platform job import gsds-ingest-jobspec.yaml --api "$API" --source agent_skill

# 3. 发布
task-platform job publish gsds-ingest --api "$API"
```

### 常见发布阻断项

| 错误 | 含义 | 修复 |
|------|------|------|
| `RUNTIME_PROFILE_MISSING` | Task 没绑定 Runtime | 注册 RuntimeProfile 后补 code |
| `CONTEXT_POLICY_MISSING` | 没绑定 ContextPolicy | 注册 ContextPolicy |
| `TOOL_NOT_PUBLISHED` | Tool 未发布 | 发布 Tool |
| `TOOL_SECRET_BINDING_MISSING` | Tool 依赖的 Secret 没绑定 | 补 secret_refs |
| `SECRET_NOT_ACTIVE` | Secret 未激活 | 激活 Secret |
| `TRIGGER_NOT_PUBLISHED` | Trigger 未发布 | 发布 Trigger |
