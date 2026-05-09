import { jsonrepair } from "jsonrepair";
import { readFile, stat } from "fs/promises";
import path from "path";

export interface CallLLMOptions {
  temperature?: number;
  expectJson?: boolean;
  maxTokens?: number;
  filePaths?: string[];
  preferChannel?: "raw" | "cursor";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonFromText(raw: string): any {
  let jsonStr = raw.trim();

  const fenceMatch = jsonStr.match(/`{3,}(?:json)?\s*([\s\S]*?)`{3,}/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      const repaired = jsonrepair(jsonStr);
      return JSON.parse(repaired);
    } catch {
      const tail = jsonStr.length > 200 ? `${jsonStr.slice(-200)}…` : jsonStr;
      throw new Error(`JSON 解析失败（可能是输出被截断）。末尾内容：${tail}`);
    }
  }
}

function formatCursorErrorDetails(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as {
    code?: string;
    status?: number;
    requestId?: string;
    operation?: string;
    endpoint?: string;
  };
  const parts: string[] = [];
  if (e.code) parts.push(`code=${e.code}`);
  if (typeof e.status === "number") parts.push(`status=${e.status}`);
  if (e.requestId) parts.push(`requestId=${e.requestId}`);
  if (e.operation) parts.push(`op=${e.operation}`);
  if (e.endpoint) parts.push(`endpoint=${e.endpoint}`);
  return parts.length ? `（${parts.join(", ")}）` : "";
}

async function parseFileToText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  if (ext === ".xlsx" || ext === ".xls") {
    const XLSX = await import("xlsx");
    const buf = await readFile(filePath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheets: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!rows.length) continue;
      const table = rows.map((r) => r.join("\t")).join("\n");
      sheets.push(`【Sheet: ${sheetName}】\n${table}`);
    }
    return `📎 文件：${name}\n${sheets.join("\n\n")}`;
  }

  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buf = await readFile(filePath);
    const pdf = await pdfParse(buf);
    return `📎 文件：${name}\n${pdf.text}`;
  }

  if (ext === ".csv" || ext === ".tsv") {
    const content = await readFile(filePath, "utf-8");
    return `📎 文件：${name}\n${content}`;
  }

  const content = await readFile(filePath, "utf-8");
  return `📎 文件：${name}\n${content}`;
}

async function buildFileContext(filePaths: string[]): Promise<string> {
  if (!filePaths.length) return "";
  const parts: string[] = ["\n\n--- 用户上传的文件 ---"];
  for (const fp of filePaths) {
    try {
      const text = await parseFileToText(fp);
      parts.push(`\n${text}`);
    } catch (err) {
      const name = path.basename(fp);
      console.warn(`[FileParser] Failed to parse ${name}:`, (err as Error).message);
      parts.push(`\n📎 文件：${name}（解析失败：${(err as Error).message}）`);
    }
  }
  return parts.join("\n");
}

async function callViaRawAPI(
  systemPrompt: string,
  userContent: string,
  options: CallLLMOptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL || "gpt-4o";

  if (!apiKey || !baseUrl) {
    throw new Error("LLM_API_KEY / LLM_BASE_URL 未配置");
  }

  const fileCtx = await buildFileContext(options.filePaths || []);
  const fullUserContent = fileCtx ? `${userContent}${fileCtx}` : userContent;

  const isClaude = model.toLowerCase().includes("claude");
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: fullUserContent },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (options.expectJson !== false && !isClaude) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");

  if (options.expectJson === false) return content;
  return parseJsonFromText(content);
}

async function callViaOpenAIAPI(
  systemPrompt: string,
  userContent: string,
  options: CallLLMOptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  const filePaths = options.filePaths || [];
  const toolMode = filePaths.length > 0 && process.env.OPENAI_ENABLE_FILE_TOOLS !== "0";

  const callCompletion = async (body: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }
    return response.json();
  };

  if (toolMode) {
    const allowedSet = new Set(filePaths);
    const readSet = new Set<string>();
    const listFileMeta = await Promise.all(
      filePaths.map(async (fp) => {
        try {
          const s = await stat(fp);
          return {
            path: fp,
            name: path.basename(fp),
            ext: path.extname(fp).toLowerCase(),
            size: s.size,
          };
        } catch {
          return {
            path: fp,
            name: path.basename(fp),
            ext: path.extname(fp).toLowerCase(),
            size: null,
          };
        }
      })
    );

    const tools = [
      {
        type: "function",
        function: {
          name: "list_files",
          description: "列出当前可访问的上传文件列表（仅这些文件可读取）",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "read_file",
          description: "读取某个上传文件并转为可分析文本（支持 pdf/xlsx/csv/txt/md/json）",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "文件绝对路径（必须来自 list_files）" },
            },
            required: ["path"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          userContent,
          "",
          "你可以使用工具读取用户上传的文件。",
          "必须先调用 list_files 查看可访问文件，然后对每个文件都调用 read_file(path) 读取内容后，才能给最终答案。",
          "禁止臆造文件内容。只能基于工具返回内容输出结论。",
          options.expectJson === false
            ? "最终输出纯文本。"
            : "最终输出必须是合法 JSON 对象（直接以 { 开头）。",
        ].join("\n"),
      },
    ];

    const maxRounds = 8;
    for (let round = 0; round < maxRounds; round++) {
      const body: Record<string, unknown> = {
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8192,
      };

      if (options.expectJson !== false) {
        body.response_format = { type: "json_object" };
      }

      const data = await callCompletion(body);
      const msg = data?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
      const content = msg?.content as string | undefined;

      if (toolCalls && toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: content ?? "",
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          const tcId = tc.id as string;
          const fn = (tc.function as Record<string, unknown>) || {};
          const fnName = fn.name as string;
          const rawArgs = (fn.arguments as string) || "{}";

          let toolResult: unknown;
          try {
            const args = JSON.parse(rawArgs) as { path?: string };
            if (fnName === "list_files") {
              toolResult = { files: listFileMeta };
            } else if (fnName === "read_file") {
              const reqPath = args.path || "";
              if (!allowedSet.has(reqPath)) {
                toolResult = { error: "path_not_allowed", message: "只能读取上传文件列表中的路径" };
              } else {
                const text = await parseFileToText(reqPath);
                readSet.add(reqPath);
                toolResult = { path: reqPath, content: text };
              }
            } else {
              toolResult = { error: "unknown_tool", message: `未知工具: ${fnName}` };
            }
          } catch (err) {
            toolResult = { error: "tool_exec_failed", message: (err as Error).message };
          }

          messages.push({
            role: "tool",
            tool_call_id: tcId,
            content: JSON.stringify(toolResult),
          });
        }
        continue;
      }

      if (readSet.size < allowedSet.size) {
        const unread = filePaths.filter((fp) => !readSet.has(fp));
        messages.push({
          role: "assistant",
          content: content ?? "",
        });
        messages.push({
          role: "user",
          content: `你还没有读取全部上传文件。请继续调用 read_file 读取以下文件后再输出最终答案：\n${unread.map((p) => `- ${p}`).join("\n")}`,
        });
        continue;
      }

      if (!content) throw new Error("OpenAI 返回为空");
      if (options.expectJson === false) return content;
      return parseJsonFromText(content);
    }

    throw new Error("OpenAI 工具调用超过最大轮次，未产出最终结果");
  }

  const fileCtx = await buildFileContext(filePaths);
  const fullUserContent = fileCtx ? `${userContent}${fileCtx}` : userContent;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: fullUserContent },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (options.expectJson !== false) {
    body.response_format = { type: "json_object" };
  }

  const data = await callCompletion(body);
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 返回为空");

  if (options.expectJson === false) return content;
  return parseJsonFromText(content);
}

async function callViaCursorSDK(
  systemPrompt: string,
  userContent: string,
  options: CallLLMOptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  const apiKey = process.env.CURSOR_API_KEY!;
  const model = process.env.CURSOR_MODEL || "composer-2";

  const filePaths = options.filePaths || [];
  const hasFiles = filePaths.length > 0;

  const fileInstruction = hasFiles
    ? `\n\n用户上传了以下文件，请先读取文件内容再进行分析：\n${filePaths.map((fp) => `- ${fp}`).join("\n")}`
    : "";

  const jsonRule = options.expectJson !== false
    ? "\n\n【输出规则】不要创建或修改任何文件。最终回复必须只包含一个合法 JSON 对象，直接以 { 开头，不要用 markdown 代码块包裹。"
    : "";

  const fullPrompt = [
    systemPrompt,
    "",
    "---",
    "",
    userContent,
    fileInstruction,
    jsonRule,
  ].join("\n");

  try {
    const result = await Agent.prompt(fullPrompt, {
      apiKey,
      model: { id: model },
      local: { cwd: process.cwd(), settingSources: [] },
    });

    if (result.status !== "finished") {
      throw new Error(`Cursor Agent 执行状态异常: ${result.status}`);
    }

    const content = result.result;
    if (!content) throw new Error("Cursor Agent 返回为空");

    console.log("[CursorSDK] Agent status:", result.status);
    console.log("[CursorSDK] Result length:", content.length);
    console.log("[CursorSDK] Result preview:", content.slice(0, 500));

    if (options.expectJson === false) return content;
    return parseJsonFromText(content);
  } catch (err) {
    if (err instanceof CursorAgentError) {
      const suffix = err.isRetryable ? "（可重试）" : "（不可重试）";
      const details = formatCursorErrorDetails(err);
      throw new Error(`Cursor Agent 错误: ${err.message}${suffix}${details}`);
    }
    throw err;
  }
}

export interface StreamEvent {
  type: "progress" | "text" | "done" | "error";
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

/**
 * Unified LLM call — routes by preferChannel:
 *   "raw"    → raw API first (fast, for short tasks like classification)
 *   "cursor" → Cursor SDK first (powerful, for generation)
 *   default  → provider-based order with fallback
 */
export async function callLLM(
  systemPrompt: string,
  userContent: string,
  options?: CallLLMOptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const opts: CallLLMOptions = {
    temperature: options?.temperature ?? 0.3,
    expectJson: options?.expectJson ?? true,
    maxTokens: options?.maxTokens ?? 8192,
    filePaths: options?.filePaths,
  };

  const hasCursorSDK = !!process.env.CURSOR_API_KEY;
  const hasRawAPI = !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
  const hasOpenAIAPI = !!process.env.OPENAI_API_KEY;
  const prefer = options?.preferChannel;
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();

  if (prefer === "raw" && hasRawAPI) {
    try {
      return await callViaRawAPI(systemPrompt, userContent, opts);
    } catch (rawErr) {
      if (hasCursorSDK) {
        try {
          console.warn("[LLM] Raw API failed, falling back to Cursor SDK:", (rawErr as Error).message);
          return await callViaCursorSDK(systemPrompt, userContent, opts);
        } catch (cursorErr) {
          console.warn("[LLM] Cursor SDK fallback failed:", (cursorErr as Error).message);
        }
      }
      if (hasOpenAIAPI) {
        try {
          console.warn("[LLM] Raw API failed, falling back to OpenAI API:", (rawErr as Error).message);
          return await callViaOpenAIAPI(systemPrompt, userContent, opts);
        } catch (openaiErr) {
          console.warn("[LLM] OpenAI API fallback failed:", (openaiErr as Error).message);
        }
      }
      throw rawErr;
    }
  }

  if (provider === "codex" || provider === "openai") {
    if (hasOpenAIAPI) {
      try {
        return await callViaOpenAIAPI(systemPrompt, userContent, opts);
      } catch (openaiErr) {
        if (hasCursorSDK) {
          try {
            console.warn("[LLM] OpenAI API failed, falling back to Cursor SDK:", (openaiErr as Error).message);
            return await callViaCursorSDK(systemPrompt, userContent, opts);
          } catch (cursorErr) {
            console.warn("[LLM] Cursor SDK fallback failed:", (cursorErr as Error).message);
          }
        }
        if (hasRawAPI) {
          try {
            console.warn("[LLM] OpenAI API failed, falling back to Raw API:", (openaiErr as Error).message);
            return await callViaRawAPI(systemPrompt, userContent, opts);
          } catch (rawErr) {
            console.warn("[LLM] Raw API fallback failed:", (rawErr as Error).message);
          }
        }
        throw openaiErr;
      }
    }
  }

  if (hasCursorSDK) {
    try {
      return await callViaCursorSDK(systemPrompt, userContent, opts);
    } catch (cursorErr) {
      if (hasOpenAIAPI) {
        try {
          console.warn("[LLM] Cursor SDK failed, falling back to OpenAI API:", (cursorErr as Error).message);
          return await callViaOpenAIAPI(systemPrompt, userContent, opts);
        } catch (openaiErr) {
          console.warn("[LLM] OpenAI API fallback failed:", (openaiErr as Error).message);
        }
      }
      if (hasRawAPI) {
        try {
          console.warn("[LLM] Cursor SDK failed, falling back to raw API:", (cursorErr as Error).message);
          return await callViaRawAPI(systemPrompt, userContent, opts);
        } catch (rawErr) {
          console.warn("[LLM] Raw API fallback failed:", (rawErr as Error).message);
        }
      }
      throw cursorErr;
    }
  }

  if (hasOpenAIAPI) {
    try {
      return await callViaOpenAIAPI(systemPrompt, userContent, opts);
    } catch (openaiErr) {
      if (hasRawAPI) {
        try {
          console.warn("[LLM] OpenAI API failed, falling back to Raw API:", (openaiErr as Error).message);
          return await callViaRawAPI(systemPrompt, userContent, opts);
        } catch (rawErr) {
          console.warn("[LLM] Raw API fallback failed:", (rawErr as Error).message);
        }
      }
      throw openaiErr;
    }
  }

  if (hasRawAPI) {
    return callViaRawAPI(systemPrompt, userContent, opts);
  }

  throw new Error("LLM 未配置：需要 CURSOR_API_KEY，或 OPENAI_API_KEY，或 LLM_API_KEY + LLM_BASE_URL");
}

export async function* streamViaCursorSDK(
  systemPrompt: string,
  userContent: string,
  options: CallLLMOptions
): AsyncGenerator<StreamEvent> {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  const apiKey = process.env.CURSOR_API_KEY!;
  const model = process.env.CURSOR_MODEL || "composer-2";

  const filePaths = options.filePaths || [];
  const hasFiles = filePaths.length > 0;

  const fileInstruction = hasFiles
    ? `\n\n用户上传了以下文件，请先读取文件内容再进行分析：\n${filePaths.map((fp) => `- ${fp}`).join("\n")}`
    : "";

  const jsonRule = options.expectJson !== false
    ? "\n\n【输出规则】不要创建或修改任何文件。最终回复必须只包含一个合法 JSON 对象，直接以 { 开头，不要用 markdown 代码块包裹。"
    : "";

  const fullPrompt = [
    systemPrompt,
    "",
    "---",
    "",
    userContent,
    fileInstruction,
    jsonRule,
  ].join("\n");

  yield { type: "progress", message: hasFiles ? "正在读取文件..." : "正在分析..." };

  const agent = await Agent.create({
    apiKey,
    model: { id: model },
    local: { cwd: process.cwd(), settingSources: [] },
  });

  try {
    const run = await agent.send(fullPrompt);
    let fullText = "";
    let sentProgress = false;
    let statusErrorMessage = "";

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        if (!sentProgress) {
          yield { type: "progress", message: "正在生成流程图..." };
          sentProgress = true;
        }
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            fullText += block.text;
            yield { type: "text", message: block.text };
          }
        }
      } else if (event.type === "status" && event.status === "ERROR") {
        statusErrorMessage = event.message || "";
      }
    }

    const result = await run.wait();
    if (result.status !== "finished") {
      const reason = statusErrorMessage ? `（${statusErrorMessage}）` : "";
      yield { type: "error", message: `Agent 执行状态异常: ${result.status}${reason}` };
      return;
    }

    const finalText = result.result || fullText;
    if (!finalText) {
      yield { type: "error", message: "Agent 返回为空" };
      return;
    }

    console.log("[CursorSDK Stream] Result length:", finalText.length);

    if (options.expectJson === false) {
      yield { type: "done", result: finalText };
    } else {
      const parsed = parseJsonFromText(finalText);
      yield { type: "done", result: parsed };
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      const suffix = err.isRetryable ? "（可重试）" : "";
      const details = formatCursorErrorDetails(err);
      yield { type: "error", message: `Agent 错误: ${err.message}${suffix}${details}` };
    } else {
      yield { type: "error", message: (err as Error).message };
    }
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}
