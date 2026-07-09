import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";

type JsonRecord = Record<string, unknown>;

type FileValue = {
  url?: string;
  file_ref?: string;
  download_url?: string;
  inline_download_url?: string;
  attachment_download_url?: string;
  public_url?: string;
  path?: string;
  uri?: string;
  artifact_id?: string;
  file_name?: string;
  mime_type?: string;
  role?: string;
  content_base64?: string;
};

type SheetSummary = {
  role: string;
  file: string;
  sheet_name: string;
  row_count: number;
  columns: string[];
};

type StandardizerRequest = {
  selectedModules: string[];
  analysisPeriod: JsonRecord;
  outputFormats: string[];
  initialDataFile?: FileValue;
  supplementDataFile?: FileValue;
  metricDictionaryFile?: FileValue;
  standardizationMode: "initial" | "supplement_merge";
};

const MODULE_REQUIREMENTS: Record<string, { sheets: string[]; dimension_fields: string[] }> = {
  商品: {
    sheets: ["product_daily"],
    dimension_fields: ["商品ID", "商品名称"],
  },
  人群: {
    sheets: ["audience_product_daily_overlap"],
    dimension_fields: ["商品ID", "商品名称", "人群ID", "人群名称"],
  },
  关键词: {
    sheets: ["keyword_product_daily_overlap"],
    dimension_fields: ["商品ID", "商品名称", "关键词"],
  },
  LBS: {
    sheets: ["product_lbs_daily"],
    dimension_fields: ["商品ID", "商品名称", "城市", "行政区", "商圈", "距离圈层"],
  },
  时段: {
    sheets: ["timeslot_product_daily"],
    dimension_fields: ["商品ID", "商品名称", "时段"],
  },
  创意: {
    sheets: ["creative_daily", "creative_product_daily"],
    dimension_fields: ["创意ID", "创意名称"],
  },
  门店承接: {
    sheets: ["store_fulfillment_daily"],
    dimension_fields: ["门店ID", "门店名称"],
  },
};

const STANDARD_FIELD_NAMES: Record<string, string> = {
  日期: "date",
  阶段: "phase",
  花费: "spend",
  曝光: "impressions",
  点击: "clicks",
  订单量: "orders",
  GMV: "gmv",
  CTR: "ctr",
  CVR: "cvr",
  CPC: "cpc",
  CPM: "cpm",
  CPA: "cpa",
  客单价: "aov",
  ROI: "roi",
  商品ID: "product_id",
  商品名称: "product_name",
  商品类型: "product_type",
  投放层级: "product_role",
  主时段: "primary_daypart",
  券后价: "discounted_price",
  商品评分: "product_rating",
  是否售罄: "is_sold_out",
  人群ID: "audience_id",
  人群名称: "audience_name",
  人群类型: "audience_type",
  覆盖口径: "coverage_method",
  关键词: "keyword",
  关键词类型: "keyword_type",
  匹配方式: "match_type",
  城市: "city",
  行政区: "district",
  商圈: "business_circle",
  距离圈层: "distance_ring",
  商圈订单密度指数: "business_circle_order_density_index",
  时段: "daypart",
  小时段: "hour_slot",
  需求指数: "demand_index",
  竞争指数: "competition_index",
  门店ID: "store_id",
  门店名称: "store_name",
  预计送达分钟: "eta_minutes",
  门店评分: "store_rating",
  门店质量分: "store_quality_score",
  平台质量分: "platform_quality_score",
  非异率: "non_exception_rate",
  入店转化率: "store_visit_conversion_rate",
  下单转化率: "order_conversion_rate",
  库存风险商品数: "stock_risk_product_count",
  售罄影响订单估算: "sold_out_impacted_order_estimate",
};

const DICTIONARY_MODULE_ALIASES: Record<string, string[]> = {
  商品: ["商品", "商品表现"],
  人群: ["人群", "人群下钻"],
  关键词: ["关键词", "关键词下钻"],
  LBS: ["LBS", "LBS 下钻", "LBS下钻"],
  时段: ["时段", "时段下钻"],
  创意: ["创意", "创意入口判断"],
  门店承接: ["门店承接"],
};

const METRIC_DEPENDENCIES: Record<string, string[]> = {
  ROI: ["GMV", "花费"],
  CTR: ["点击", "曝光"],
  CVR: ["订单量", "点击"],
  CPC: ["花费", "点击"],
  CPM: ["花费", "曝光"],
  CPA: ["花费", "订单量"],
  客单价: ["GMV", "订单量"],
  GMV占比: ["GMV"],
  花费占比: ["花费"],
  阶段变化率: ["日期", "阶段"],
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSchemaLike(value: unknown) {
  return isRecord(value) && typeof value.type === "string" && (
    isRecord(value.properties) ||
    value.items !== undefined ||
    value.additionalProperties !== undefined ||
    Array.isArray(value.required) ||
    Array.isArray(value.enum)
  );
}

function deepFind(value: unknown, names: string[], seen = new Set<unknown>(), depth = 0): unknown {
  if (!value || typeof value !== "object" || seen.has(value) || depth > 10 || isSchemaLike(value)) return undefined;
  seen.add(value);
  if (isRecord(value)) {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(value, name) && value[name] !== undefined && value[name] !== null) {
        return value[name];
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (["input_schema", "output_schema", "schema", "properties", "items"].includes(key)) continue;
      const found = deepFind(child, names, seen, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  for (const child of value as unknown[]) {
    const found = deepFind(child, names, seen, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function pick(payload: unknown, ...names: string[]) {
  return deepFind(payload, names);
}

function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null || value === "") return [];
  return [value as T];
}

function toText(value: unknown, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeRow(row: JsonRecord) {
  const normalized: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedKey) normalized[normalizedKey] = value;
  }
  return normalized;
}

function normalizeObjectKeys(row: JsonRecord) {
  const mapped: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[STANDARD_FIELD_NAMES[key] || key] = value;
  }
  return mapped;
}

function fileUrl(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "";
  return String(
    value.url ||
      value.file_ref ||
      value.download_url ||
      value.inline_download_url ||
      value.attachment_download_url ||
      value.public_url ||
      value.path ||
      "",
  );
}

function hasFileReference(value: unknown) {
  if (!value) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (!isRecord(value)) return false;
  return Boolean(fileUrl(value) || value.content_base64 || value.artifact_id || value.uri);
}

function taskPlatformApiBaseUrl() {
  return (process.env.TASK_PLATFORM_API_BASE_URL || "https://task-platform-staging.nodesk.tech/api/platform").replace(/\/$/, "");
}

async function resolveArtifactAccessUrl(artifactId: string, label: string) {
  const token = process.env.TASK_PLATFORM_TOKEN || process.env.TASK_PLATFORM_API_TOKEN;
  if (!token) {
    throw createError(
      "ARTIFACT_DOWNLOAD_AUTH_MISSING",
      `${label} uses artifact_id but TASK_PLATFORM_TOKEN is not configured for the adapter service.`,
      false,
      { artifact_id: artifactId },
    );
  }
  const response = await fetch(
    `${taskPlatformApiBaseUrl()}/artifacts/${encodeURIComponent(artifactId)}/access?disposition=inline`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw createError("ARTIFACT_ACCESS_FAILED", `${label} artifact access failed with HTTP ${response.status}.`, false, {
      artifact_id: artifactId,
    });
  }
  const payload = (await response.json()) as JsonRecord;
  const url = toText(payload.url);
  if (!url) {
    throw createError("ARTIFACT_ACCESS_URL_MISSING", `${label} artifact access response did not include a download URL.`, false, {
      artifact_id: artifactId,
    });
  }
  return url;
}

function fileName(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.file_name === "string" && value.file_name) return value.file_name;
  const url = fileUrl(value);
  const last = decodeURIComponent(url.split("?")[0]?.split("/").filter(Boolean).pop() || "");
  return last || fallback;
}

async function downloadFile(value: unknown, label: string) {
  if (isRecord(value) && typeof value.content_base64 === "string" && value.content_base64) {
    return Buffer.from(value.content_base64, "base64");
  }
  let url = fileUrl(value);
  if (
    isRecord(value) &&
    typeof value.artifact_id === "string" &&
    value.artifact_id &&
    (!url || url.startsWith("/"))
  ) {
    url = await resolveArtifactAccessUrl(value.artifact_id, label);
  }
  if (!url) throw createError("INVALID_FILE_REF", `${label} must include url or file_ref.`);
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] || "";
    return Buffer.from(base64, "base64");
  }
  const headers: HeadersInit = {};
  if (url.includes("task-platform-staging.nodesk.tech") && process.env.TASK_PLATFORM_TOKEN) {
    headers.authorization = `Bearer ${process.env.TASK_PLATFORM_TOKEN}`;
  }
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw createError("FILE_DOWNLOAD_FAILED", `${label} download failed with HTTP ${response.status}.`, false, { url });
  }
  return Buffer.from(await response.arrayBuffer());
}

function workbookFromBuffer(buffer: Buffer) {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

function workbookRows(workbook: XLSX.WorkBook) {
  const sheets: Record<string, JsonRecord[]> = {};
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    sheets[sheetName] = XLSX.utils.sheet_to_json<JsonRecord>(sheet, { defval: null, raw: false }).map(normalizeRow);
  }
  return sheets;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const normalized = String(value).trim().replaceAll("/", "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inAnalysisPeriod(row: JsonRecord, period: JsonRecord) {
  const start = parseDate(period.start_date || period.start || period.from);
  const end = parseDate(period.end_date || period.end || period.to);
  if (!start && !end) return true;
  const rowDate = parseDate(row["日期"] || row.date);
  if (!rowDate) return true;
  if (start && rowDate < start) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (rowDate > endOfDay) return false;
  }
  return true;
}

function parseWorkbookSummary(buffer: Buffer, role: string, file: string, period: JsonRecord) {
  const workbook = workbookFromBuffer(buffer);
  const rowsBySheet = workbookRows(workbook);
  const sheets: SheetSummary[] = [];
  const tables: Record<string, JsonRecord[]> = {};
  for (const sheetName of workbook.SheetNames) {
    const filtered = (rowsBySheet[sheetName] || []).filter((row) => inAnalysisPeriod(row, period));
    sheets.push({
      role,
      file,
      sheet_name: sheetName,
      row_count: filtered.length,
      columns: filtered[0] ? Object.keys(filtered[0]) : Object.keys((rowsBySheet[sheetName] || [])[0] || {}),
    });
    tables[sheetName] = filtered.map(normalizeObjectKeys);
  }
  return { sheets, tables };
}

function findHeaderRow(rows: unknown[][], requiredLabels: string[]) {
  return rows.findIndex((row) => requiredLabels.every((label) => row.map((item) => toText(item).trim()).includes(label)));
}

function rowObject(headers: string[], row: unknown[]) {
  const object: JsonRecord = {};
  headers.forEach((header, index) => {
    const key = toText(header).trim();
    if (key) object[key] = row[index] ?? null;
  });
  return object;
}

function splitList(value: unknown) {
  return toText(value)
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFieldSheet(rows: unknown[][], requiredLabels: string[]) {
  const headerIndex = findHeaderRow(rows, requiredLabels);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((item) => toText(item).trim());
  return rows
    .slice(headerIndex + 1)
    .map((row) => rowObject(headers, row))
    .filter((item) => toText(item["中文字段"]) && toText(item["英文名"]))
    .map((item) => ({
      chinese_name: toText(item["中文字段"]),
      english_name: toText(item["英文名"]),
      aliases: splitList(item["常见别称"]),
      field_type: toText(item["字段类型"]),
      data_format: toText(item["数据格式"]),
      formula_or_source: toText(item["计算公式"] ?? item["计算公式/来源"]),
      calculation_scope_or_usage: toText(item["计算口径/分母"] ?? item["分析用途"]),
      modules: splitList(item["出现模块"]),
      notes: toText(item["备注"]),
    }));
}

function parseModuleMappings(rows: unknown[][]) {
  const headerIndex = findHeaderRow(rows, ["模块", "主要计算字段"]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((item) => toText(item).trim());
  return rows
    .slice(headerIndex + 1)
    .map((row) => rowObject(headers, row))
    .filter((item) => toText(item["模块"]))
    .map((item) => ({
      module: toText(item["模块"]),
      primary_fields: splitList(item["主要计算字段"]),
      analyzable_questions: splitList(item["可分析的问题"]),
      required_supplement_data: splitList(item["需要补充的数据"]),
    }));
}

function parseMetricDictionary(buffer: Buffer, sourceFile: string) {
  const workbook = workbookFromBuffer(buffer);
  const sheetRows: Record<string, unknown[][]> = {};
  for (const sheetName of workbook.SheetNames) {
    sheetRows[sheetName] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    });
  }
  const coreFields = parseFieldSheet(sheetRows["核心计算字段"] || [], ["中文字段", "英文名", "字段类型"]);
  const deliveryFields = parseFieldSheet(sheetRows["外卖特有字段"] || [], ["中文字段", "英文名", "字段类型"]);
  const moduleMappings = parseModuleMappings(sheetRows["模块字段映射"] || []);
  return {
    source_file: sourceFile,
    parsed_at: new Date().toISOString(),
    parser_version: "retail-ad-review-metric-dictionary-v1",
    field_definitions: [...coreFields, ...deliveryFields],
    module_mappings: moduleMappings,
    summary: {
      sheet_count: workbook.SheetNames.length,
      field_definition_count: coreFields.length + deliveryFields.length,
      module_mapping_count: moduleMappings.length,
      sheets: workbook.SheetNames,
    },
  };
}

function detectAvailableDimensions(sheets: SheetSummary[]) {
  const dimensions = new Set(["日期"]);
  for (const sheet of sheets) {
    for (const column of sheet.columns) {
      if (["花费", "曝光", "点击", "订单量", "GMV"].includes(column)) dimensions.add("趋势诊断");
      if (["商品ID", "商品名称"].includes(column)) dimensions.add("商品");
      if (["人群ID", "人群名称"].includes(column)) dimensions.add("人群");
      if (["关键词", "关键词类型"].includes(column)) dimensions.add("关键词");
      if (["城市", "行政区", "商圈", "距离圈层"].includes(column)) dimensions.add("LBS");
      if (["时段", "小时段"].includes(column)) dimensions.add("时段");
      if (["门店ID", "门店名称", "预计送达分钟"].includes(column)) dimensions.add("门店承接");
      if (["创意ID", "创意名称"].includes(column)) dimensions.add("创意");
    }
  }
  return [...dimensions];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function fieldsFromDictionaryRequirement(dictionaryRequirement: JsonRecord | undefined) {
  const primaryFields = asArray<string>(dictionaryRequirement?.primary_fields);
  if (!primaryFields.length) return ["花费", "曝光", "点击", "订单量", "GMV"];
  return unique(primaryFields.flatMap((field) => METRIC_DEPENDENCIES[field] || [field]));
}

function findCandidateSheets(sheets: SheetSummary[], requirement: { sheets: string[]; dimension_fields: string[] }) {
  const expectedSheets = new Set(requirement.sheets || []);
  const expectedMatches = sheets.filter((sheet) => expectedSheets.has(sheet.sheet_name) && sheet.row_count > 0);
  if (expectedMatches.length) return expectedMatches;
  return sheets.filter((sheet) => {
    if (sheet.row_count <= 0) return false;
    const available = new Set(sheet.columns);
    return requirement.dimension_fields.every((field) => available.has(field));
  });
}

function evaluateModule(moduleName: string, sheets: SheetSummary[], metricDictionary: JsonRecord | null) {
  const requirement = MODULE_REQUIREMENTS[moduleName];
  const dictionaryNames = DICTIONARY_MODULE_ALIASES[moduleName] || [moduleName];
  const moduleMappings = asArray<JsonRecord>(metricDictionary?.module_mappings);
  const dictionaryRequirement = moduleMappings.find((item) => dictionaryNames.includes(toText(item.module)));
  const dictionaryFields = fieldsFromDictionaryRequirement(dictionaryRequirement);
  if (!requirement) {
    return {
      module: moduleName,
      status: "unsupported",
      missing_sheets: [],
      missing_fields: dictionaryFields,
      dictionary_requirement: dictionaryRequirement || null,
      reason: "未定义该模块的数据需求。",
    };
  }
  const requiredFields = unique(["日期", ...requirement.dimension_fields, ...dictionaryFields]);
  const matchingSheets = findCandidateSheets(sheets, requirement);
  if (!matchingSheets.length) {
    return {
      module: moduleName,
      status: "unsupported",
      missing_sheets: requirement.sheets,
      missing_fields: requiredFields,
      dictionary_requirement: dictionaryRequirement || null,
      reason: `缺少可支持「${moduleName}」分析的维度字段：${requirement.dimension_fields.join("、")}。`,
    };
  }
  const available = new Set(matchingSheets.flatMap((sheet) => sheet.columns));
  const missingFields = requiredFields.filter((field) => !available.has(field));
  return {
    module: moduleName,
    status: missingFields.length ? "limited" : "supported",
    source_sheets: matchingSheets.map((sheet) => sheet.sheet_name),
    row_count: matchingSheets.reduce((sum, sheet) => sum + sheet.row_count, 0),
    missing_sheets: [],
    missing_fields: missingFields,
    dictionary_requirement: dictionaryRequirement || null,
    reason: missingFields.length ? `缺少字段：${missingFields.join("、")}` : "字段满足模块分析要求。",
  };
}

function createFieldMapping(sheets: SheetSummary[]) {
  const seen = new Set<string>();
  const mappings = [];
  for (const sheet of sheets) {
    for (const column of sheet.columns) {
      const key = `${sheet.sheet_name}:${column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mappings.push({
        source_file: sheet.file,
        source_role: sheet.role,
        source_sheet: sheet.sheet_name,
        source_column: column,
        standard_field: STANDARD_FIELD_NAMES[column] || column,
      });
    }
  }
  return mappings;
}

function createError(code: string, message: string, retryable = false, details: JsonRecord = {}) {
  const error = new Error(message);
  (error as Error & { payload: JsonRecord }).payload = { code, message, retryable, details };
  return error;
}

function normalizeStandardizerRequest(payload: JsonRecord): StandardizerRequest {
  const selectedModules = asArray<string>(pick(payload, "fld-selected-modules", "selected_modules", "selectedModules"));
  const outputFormats = asArray<string>(pick(payload, "fld-output-formats", "output_formats", "outputFormats"));
  const analysisPeriod = (pick(payload, "fld-analysis-period", "analysis_period", "analysisPeriod") || {}) as JsonRecord;
  const mode = toText(pick(payload, "fld-standardization-mode", "standardization_mode", "standardizationMode"), "initial");
  const supplementDataFile = pick(payload, "fld-supplement-data-file", "supplement_data_file", "supplementDataFile") as
    | FileValue
    | undefined;
  const needsSupplementData = pick(payload, "need_supplement_data", "fld-need-supplement-data");
  const hasSupplementDataFile = hasFileReference(supplementDataFile);
  const supplementRequested =
    needsSupplementData === undefined ||
    needsSupplementData === true ||
    needsSupplementData === "true" ||
    needsSupplementData === "1" ||
    needsSupplementData === 1;
  const shouldMergeSupplement =
    mode === "supplement_merge" || (hasSupplementDataFile && supplementRequested);
  return {
    selectedModules: selectedModules.length ? selectedModules : ["商品"],
    outputFormats: outputFormats.length ? outputFormats : ["html"],
    analysisPeriod,
    standardizationMode: shouldMergeSupplement ? "supplement_merge" : "initial",
    initialDataFile: pick(payload, "fld-initial-data-file", "initial_data_file", "initialDataFile") as FileValue | undefined,
    supplementDataFile,
    metricDictionaryFile: pick(payload, "fld-metric-dictionary-file", "metric_dictionary_file", "metricDictionaryFile") as FileValue | undefined,
  };
}

function buildFileRef(name: string, role: string, content: unknown, mimeType = "application/json") {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const base64 = Buffer.from(body, "utf8").toString("base64");
  return {
    role,
    file_name: name,
    mime_type: mimeType,
    content_base64: base64,
    public_url: `data:${mimeType};base64,${base64}`,
  };
}

function buildReviewMaterials(input: {
  selectedModules: string[];
  analysisPeriod: JsonRecord;
  outputFormats: string[];
  files: { file: string; role: string }[];
  moduleSupportMatrix: JsonRecord[];
  supportedModules: string[];
  unsupportedModules: string[];
  missingFieldRequirements: JsonRecord[];
  dataQualityReport: JsonRecord;
  standardizationSummary: JsonRecord;
  supplementRequest: JsonRecord;
}) {
  const moduleGapItems = input.moduleSupportMatrix.map((item) => ({
    module: item.module,
    status: item.status,
    display_status: item.status === "supported" ? "可继续分析" : item.status === "limited" ? "可有限分析" : "建议补数",
    reason: item.reason,
    missing_fields: item.missing_fields || [],
    missing_sheets: item.missing_sheets || [],
    dictionary_requirement: item.dictionary_requirement || null,
  }));
  const reviewScopeSummary = {
    analysis_period: input.analysisPeriod,
    selected_modules: input.selectedModules,
    output_formats: input.outputFormats,
    summary_text: `本次选择 ${input.selectedModules.length} 个模块，分析周期 ${input.analysisPeriod.start_date || "-"} 至 ${input.analysisPeriod.end_date || "-"}。`,
  };
  const reviewDataSummary = {
    parse_status: "success",
    source_files: input.files.map((item) => ({ role: item.role, file_ref: item.file })),
    processed_sheets: input.standardizationSummary.processed_sheets,
    processed_rows: input.standardizationSummary.processed_rows,
    metric_dictionary_loaded: input.standardizationSummary.metric_dictionary_loaded,
    quality_status: input.dataQualityReport.status,
    summary_text: `已识别 ${input.standardizationSummary.processed_sheets} 个数据表，处理 ${input.standardizationSummary.processed_rows} 行数据。`,
  };
  const reviewModuleGapSummary = {
    supported_count: input.supportedModules.length,
    unsupported_count: input.unsupportedModules.length,
    supported_modules: input.supportedModules,
    unsupported_modules: input.unsupportedModules,
    items: moduleGapItems,
    summary_text: input.unsupportedModules.length
      ? `${input.unsupportedModules.length} 个模块建议补数：${input.unsupportedModules.join("、")}。`
      : "所选模块均可继续分析，无需补数。",
  };
  const reviewSupplementGuidance = {
    required: Boolean(input.supplementRequest.required),
    message: input.supplementRequest.message,
    requirements: input.missingFieldRequirements,
    upload_field: input.supplementRequest.required ? "supplement_data_file" : null,
  };
  return {
    reviewScopeSummary,
    reviewDataSummary,
    reviewModuleGapSummary,
    reviewSupplementGuidance,
    reviewMaterials: {
      title: "数据颗粒度判断与补数要求",
      analysis_scope_summary: reviewScopeSummary,
      data_readiness_summary: reviewDataSummary,
      module_gap_summary: moduleGapItems,
      supplement_guidance: reviewSupplementGuidance,
    },
  };
}

export async function runStandardizer(payload: JsonRecord) {
  const request = normalizeStandardizerRequest(payload);
  if (!request.initialDataFile) throw createError("SCHEMA_VALIDATION_FAILED", "Missing initial_data_file.");
  if (!request.metricDictionaryFile) throw createError("SCHEMA_VALIDATION_FAILED", "Missing metric_dictionary_file.");

  const files: { value: unknown; role: string; file: string; buffer: Buffer }[] = [
    {
      value: request.initialDataFile,
      role: "initial",
      file: fileUrl(request.initialDataFile),
      buffer: await downloadFile(request.initialDataFile, "initial_data_file"),
    },
  ];
  const supplementDataFile = request.supplementDataFile;
  if (request.standardizationMode === "supplement_merge" && hasFileReference(supplementDataFile)) {
    files.push({
      value: supplementDataFile,
      role: "supplement",
      file: fileUrl(supplementDataFile) || `artifact:${supplementDataFile?.artifact_id || supplementDataFile?.uri || "supplement"}`,
      buffer: await downloadFile(supplementDataFile, "supplement_data_file"),
    });
  }
  const dictionaryBuffer = await downloadFile(request.metricDictionaryFile, "metric_dictionary_file");
  const metricDictionary = parseMetricDictionary(dictionaryBuffer, fileUrl(request.metricDictionaryFile));

  const allSheets: SheetSummary[] = [];
  const standardizedTables: Record<string, JsonRecord[]> = {};
  for (const item of files) {
    const parsed = parseWorkbookSummary(item.buffer, item.role, item.file, request.analysisPeriod);
    allSheets.push(...parsed.sheets);
    for (const [sheetName, rows] of Object.entries(parsed.tables)) {
      if (!standardizedTables[sheetName]) standardizedTables[sheetName] = [];
      standardizedTables[sheetName].push(...rows);
    }
  }

  const moduleSupportMatrix = request.selectedModules.map((moduleName) => evaluateModule(moduleName, allSheets, metricDictionary));
  const supportedModules = moduleSupportMatrix
    .filter((item) => item.status === "supported" || item.status === "limited")
    .map((item) => toText(item.module));
  const unsupportedModules = moduleSupportMatrix.filter((item) => item.status === "unsupported").map((item) => toText(item.module));
  const missingFieldRequirements = moduleSupportMatrix
    .filter((item) => item.status !== "supported")
    .map((item) => ({
      module: item.module,
      missing_sheets: item.missing_sheets || [],
      missing_fields: item.missing_fields || [],
      dictionary_requirement: item.dictionary_requirement || null,
      reason: item.reason,
    }));
  const standardizedDataset = {
    generated_at: new Date().toISOString(),
    mode: request.standardizationMode,
    tables: standardizedTables,
  };
  const fieldMapping = { mappings: createFieldMapping(allSheets) };
  const rawDataArchive = {
    files: files.map((item) => ({ role: item.role, file_ref: item.file, file_name: fileName(item.value, `${item.role}.xlsx`) })),
    sheets: allSheets,
  };
  const dataQualityReport = {
    status: unsupportedModules.length ? "needs_user_decision" : "ready",
    sheet_count: allSheets.length,
    files: rawDataArchive.files,
    metric_dictionary_file: fileUrl(request.metricDictionaryFile),
    warnings: missingFieldRequirements.map((item) => item.reason),
  };
  const standardizationSummary = {
    mode: request.standardizationMode,
    processed_files: files.length,
    processed_sheets: allSheets.length,
    processed_rows: allSheets.reduce((sum, sheet) => sum + sheet.row_count, 0),
    selected_modules: request.selectedModules,
    output_formats: request.outputFormats,
    metric_dictionary_loaded: true,
  };
  const supplementRequest = unsupportedModules.length
    ? {
        required: true,
        message: `请补充 ${unsupportedModules.join("、")} 对应的数据表或字段。`,
        requirements: missingFieldRequirements,
      }
    : {
        required: false,
        message: "当前数据已经覆盖所选模块，无需补数。",
      };
  const review = buildReviewMaterials({
    selectedModules: request.selectedModules,
    analysisPeriod: request.analysisPeriod,
    outputFormats: request.outputFormats,
    files: rawDataArchive.files.map((item) => ({ role: item.role, file: item.file_ref })),
    moduleSupportMatrix,
    supportedModules,
    unsupportedModules,
    missingFieldRequirements,
    dataQualityReport,
    standardizationSummary,
    supplementRequest,
  });
  const rawRef = buildFileRef("raw-data-archive.json", "raw_data_archive", rawDataArchive);
  const datasetRef = buildFileRef("standardized-dataset.json", "standardized_dataset", standardizedDataset);
  const mappingRef = buildFileRef("field-mapping.json", "field_mapping", fieldMapping);
  const dictionaryRef = buildFileRef("metric-dictionary-snapshot.json", "metric_dictionary_snapshot", metricDictionary);
  const granularityStatus = unsupportedModules.length
    ? "unsupported_requires_user_decision"
    : moduleSupportMatrix.some((item) => item.status === "limited")
      ? "partially_supported"
      : "all_supported";

  return {
    jobFields: {
      granularity_status: granularityStatus,
      supported_modules: supportedModules,
      unsupported_modules: unsupportedModules,
      supplement_request: supplementRequest,
      review_scope_summary: review.reviewScopeSummary,
      review_data_summary: review.reviewDataSummary,
      review_module_gap_summary: review.reviewModuleGapSummary,
      review_supplement_guidance: review.reviewSupplementGuidance,
      review_materials: review.reviewMaterials,
    },
    techFields: {
      raw_data_archive: rawDataArchive,
      standardized_dataset: standardizedDataset,
      field_mapping: fieldMapping,
      metric_dictionary_snapshot: metricDictionary,
      data_quality_report: dataQualityReport,
      available_dimensions: detectAvailableDimensions(allSheets),
      module_data_availability: moduleSupportMatrix,
      standardization_summary: standardizationSummary,
      module_support_matrix: moduleSupportMatrix,
      missing_field_requirements: missingFieldRequirements,
      raw_data_archive_ref: rawRef,
      standardized_dataset_ref: datasetRef,
      field_mapping_ref: mappingRef,
      metric_dictionary_snapshot_ref: dictionaryRef,
    },
    raw_data_archive: rawDataArchive,
    standardized_dataset: standardizedDataset,
    field_mapping: fieldMapping,
    metric_dictionary_snapshot: metricDictionary,
    data_quality_report: dataQualityReport,
    available_dimensions: detectAvailableDimensions(allSheets),
    module_data_availability: moduleSupportMatrix,
    standardization_summary: standardizationSummary,
    granularity_status: granularityStatus,
    module_support_matrix: moduleSupportMatrix,
    supported_modules: supportedModules,
    unsupported_modules: unsupportedModules,
    missing_field_requirements: missingFieldRequirements,
    supplement_request: supplementRequest,
    review_scope_summary: review.reviewScopeSummary,
    review_data_summary: review.reviewDataSummary,
    review_module_gap_summary: review.reviewModuleGapSummary,
    review_supplement_guidance: review.reviewSupplementGuidance,
    review_materials: review.reviewMaterials,
    "fld-raw-data-archive-ref": rawRef,
    "fld-standardized-dataset-ref": datasetRef,
    "fld-field-mapping-ref": mappingRef,
    "fld-metric-dictionary-snapshot-ref": dictionaryRef,
    "fld-data-quality-report": dataQualityReport,
    "fld-available-dimensions": detectAvailableDimensions(allSheets),
    "fld-module-data-availability": moduleSupportMatrix,
    "fld-standardization-summary": standardizationSummary,
    "fld-granularity-status": granularityStatus,
    "fld-module-support-matrix": moduleSupportMatrix,
    "fld-supported-modules": supportedModules,
    "fld-unsupported-modules": unsupportedModules,
    "fld-missing-field-requirements": missingFieldRequirements,
    "fld-supplement-request": supplementRequest,
    "fld-review-scope-summary": review.reviewScopeSummary,
    "fld-review-data-summary": review.reviewDataSummary,
    "fld-review-module-gap-summary": review.reviewModuleGapSummary,
    "fld-review-supplement-guidance": review.reviewSupplementGuidance,
    "fld-review-materials": review.reviewMaterials,
  };
}

function num(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replaceAll(",", "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: unknown, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
}

function money(value: unknown) {
  return num(value).toFixed(2);
}

function percent(value: unknown) {
  return `${(num(value) * 100).toFixed(2)}%`;
}

function aggregate(rows: JsonRecord[]) {
  const base = rows.reduce<{ spend: number; impressions: number; clicks: number; orders: number; gmv: number }>(
    (acc, row) => {
      acc.spend += num(row.spend);
      acc.impressions += num(row.impressions);
      acc.clicks += num(row.clicks);
      acc.orders += num(row.orders);
      acc.gmv += num(row.gmv);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, orders: 0, gmv: 0 },
  );
  return {
    ...base,
    ctr: base.impressions ? base.clicks / base.impressions : 0,
    cvr: base.clicks ? base.orders / base.clicks : 0,
    cpc: base.clicks ? base.spend / base.clicks : 0,
    cpa: base.orders ? base.spend / base.orders : 0,
    aov: base.orders ? base.gmv / base.orders : 0,
    roi: base.spend ? base.gmv / base.spend : 0,
  };
}

function metricModel(metrics: ReturnType<typeof aggregate>) {
  return {
    spend: round(metrics.spend),
    impressions: round(metrics.impressions, 0),
    clicks: round(metrics.clicks, 0),
    orders: round(metrics.orders, 0),
    gmv: round(metrics.gmv),
    ctr: round(metrics.ctr, 4),
    cvr: round(metrics.cvr, 4),
    cpc: round(metrics.cpc),
    cpa: round(metrics.cpa),
    aov: round(metrics.aov),
    roi: round(metrics.roi),
  };
}

function tableRows(dataset: JsonRecord, name: string) {
  const tables = isRecord(dataset.tables) ? dataset.tables : {};
  return asArray<JsonRecord>(tables[name]);
}

function groupRows(rows: JsonRecord[], key: string) {
  const groups = new Map<string, JsonRecord[]>();
  for (const row of rows) {
    const value = toText(row[key], "(空)");
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value)?.push(row);
  }
  return [...groups.entries()].map(([name, group]) => ({
    name,
    row_count: group.length,
    metrics: metricModel(aggregate(group)),
  }));
}

function getEmbeddedJson(value: unknown) {
  if (isRecord(value) && typeof value.content_base64 === "string") {
    try {
      return JSON.parse(Buffer.from(value.content_base64, "base64").toString("utf8")) as JsonRecord;
    } catch {
      return null;
    }
  }
  if (isRecord(value) && isRecord(value.tables)) return value;
  return isRecord(value) ? value : null;
}

function normalizeDiagnosisRequest(payload: JsonRecord) {
  const standardizedDataset = getEmbeddedJson(
    pick(payload, "standardized_dataset", "fld-standardized-dataset", "fld-standardized-dataset-ref", "standardized_dataset_ref", "in-diagnosis-standardized-dataset-ref"),
  ) || {};
  return {
    analysisPeriod: (pick(payload, "in-diagnosis-analysis-period", "analysis_period", "fld-analysis-period") || {}) as JsonRecord,
    selectedModules: asArray<string>(pick(payload, "in-diagnosis-selected-modules", "selected_modules", "fld-selected-modules")),
    confirmedSupportedModules: asArray<string>(
      pick(payload, "in-diagnosis-confirmed-supported-modules", "confirmed_supported_modules", "supported_modules", "fld-confirmed-supported-modules"),
    ),
    unsupportedModules: asArray<string>(pick(payload, "in-diagnosis-unsupported-modules", "unsupported_modules", "fld-unsupported-modules")),
    moduleSupportMatrix: asArray<JsonRecord>(
      pick(payload, "module_support_matrix", "fld-module-support-matrix", "in-diagnosis-module-support-matrix"),
    ),
    standardizedDataset,
  };
}

function periodLabel(period: JsonRecord) {
  const start = toText(period.start_date || period.start || period.from);
  const end = toText(period.end_date || period.end || period.to);
  return start || end ? `${start || "开始"} 至 ${end || "结束"}` : "未指定周期";
}

function activeModules(selected: string[], confirmed: string[]) {
  const allowed = confirmed.length ? confirmed : selected;
  return selected.filter((moduleName) => allowed.includes(moduleName));
}

function buildModuleFindings(dataset: JsonRecord, modules: string[], period: string) {
  const findings = [];
  if (modules.includes("商品")) {
    const rows = tableRows(dataset, "product_daily");
    const rankings = groupRows(rows, "product_name").sort((a, b) => num(b.metrics.roi) - num(a.metrics.roi)).slice(0, 5);
    findings.push({
      module: "商品",
      finding: rankings.length
        ? `商品 ROI 分层明显：${rankings.map((item) => `${item.name} ROI ${money(item.metrics.roi)}`).join("、")}。`
        : "当前商品数据不足，无法做商品级归因。",
      metric: "ROI/CPC/CVR",
      severity: rankings.length ? "medium" : "low",
      evidence: { source: "product_daily", period },
    });
  }
  if (modules.includes("人群")) {
    const rows = tableRows(dataset, "audience_product_daily_overlap");
    const rankings = groupRows(rows, "audience_name").sort((a, b) => num(b.metrics.roi) - num(a.metrics.roi)).slice(0, 5);
    findings.push({
      module: "人群",
      finding: rankings.length
        ? `人群效率有差异：${rankings.map((item) => `${item.name} ROI ${money(item.metrics.roi)}`).join("、")}。`
        : "当前人群数据不足，无法做确定归因。",
      metric: "ROI/CVR/CPA",
      severity: rankings.length ? "medium" : "low",
      evidence: { source: "audience_product_daily_overlap", period },
    });
  }
  if (modules.includes("关键词")) {
    const rows = tableRows(dataset, "keyword_product_daily_overlap");
    const rankings = groupRows(rows, "keyword").sort((a, b) => num(b.metrics.spend) - num(a.metrics.spend)).slice(0, 5);
    findings.push({
      module: "关键词",
      finding: rankings.length
        ? `关键词成本贡献集中：${rankings.map((item) => `${item.name} 花费 ${money(item.metrics.spend)} ROI ${money(item.metrics.roi)}`).join("、")}。`
        : "当前关键词数据不足，无法做确定归因。",
      metric: "ROI/CPC/CVR",
      severity: rankings.length ? "medium" : "low",
      evidence: { source: "keyword_product_daily_overlap", period },
    });
  }
  if (modules.includes("LBS")) {
    const rows = tableRows(dataset, "product_lbs_daily");
    const rankings = groupRows(rows, "distance_ring").sort((a, b) => num(a.metrics.roi) - num(b.metrics.roi)).slice(0, 5);
    findings.push({
      module: "LBS",
      finding: rankings.length
        ? `距离圈层存在效率差异：${rankings.map((item) => `${item.name} ROI ${money(item.metrics.roi)} CPC ${money(item.metrics.cpc)}`).join("、")}。`
        : "当前 LBS 数据不足，无法做确定归因。",
      metric: "ROI/CPC",
      severity: rankings.length ? "high" : "low",
      evidence: { source: "product_lbs_daily", period },
    });
  }
  if (modules.includes("时段")) {
    const rows = tableRows(dataset, "timeslot_product_daily");
    const rankings = groupRows(rows, "daypart").sort((a, b) => num(b.metrics.spend) - num(a.metrics.spend)).slice(0, 5);
    findings.push({
      module: "时段",
      finding: rankings.length
        ? `高消耗时段需要关注：${rankings.map((item) => `${item.name} 花费 ${money(item.metrics.spend)} ROI ${money(item.metrics.roi)}`).join("、")}。`
        : "当前时段数据不足，无法做确定归因。",
      metric: "ROI/CPC",
      severity: rankings.length ? "medium" : "low",
      evidence: { source: "timeslot_product_daily", period },
    });
  }
  if (modules.includes("门店承接")) {
    const rows = tableRows(dataset, "store_fulfillment_daily");
    const rankings = groupRows(rows, "store_name").slice(0, 5);
    findings.push({
      module: "门店承接",
      finding: rankings.length
        ? `门店承接可解释配送和库存风险：${rankings.map((item) => item.name).join("、")}。`
        : "当前门店承接数据不足，无法做确定归因。",
      metric: "ETA/库存/质量",
      severity: rankings.length ? "medium" : "low",
      evidence: { source: "store_fulfillment_daily", period },
    });
  }
  return findings;
}

export async function runDiagnosis(payload: JsonRecord) {
  const request = normalizeDiagnosisRequest(payload);
  const dailyRows = tableRows(request.standardizedDataset, "daily_totals").length
    ? tableRows(request.standardizedDataset, "daily_totals")
    : Object.values(isRecord(request.standardizedDataset.tables) ? request.standardizedDataset.tables : {})
      .flatMap((rows) => asArray<JsonRecord>(rows))
      .filter((row) => row.spend !== undefined || row.gmv !== undefined)
      .slice(0, 5000);
  const overall = aggregate(dailyRows);
  const period = periodLabel(request.analysisPeriod);
  const modules = activeModules(request.selectedModules, request.confirmedSupportedModules);
  const moduleFindings = buildModuleFindings(request.standardizedDataset, modules, period);
  const diagnosisSummary = {
    summary: `本周期整体 ROI ${money(overall.roi)}，CPC ${money(overall.cpc)}，CTR ${percent(overall.ctr)}，CVR ${percent(overall.cvr)}。建议围绕已确认模块做预算结构校正。`,
    supported_modules: modules,
    unsupported_modules: request.unsupportedModules,
    metric_snapshot: metricModel(overall),
  };
  const trendDiagnosis = {
    period,
    summary: diagnosisSummary.summary,
    metrics: metricModel(overall),
    symptom: overall.roi < 10 ? "ROI 处于需要优化区间，优先排查高花费低转化模块。" : "ROI 相对稳定，重点识别可扩量模块和局部低效点。",
    panels: [
      { title: "ROI", value: round(overall.roi), explanation: "整体投入产出效率" },
      { title: "CPC", value: round(overall.cpc), explanation: "平均点击成本" },
      { title: "CTR", value: round(overall.ctr, 4), explanation: "曝光到点击效率" },
      { title: "CVR", value: round(overall.cvr, 4), explanation: "点击到下单效率" },
    ],
  };
  const problemHypotheses = moduleFindings.map((item) => ({
    title: `${item.module}优化假设`,
    hypothesis: item.finding,
    evidence_level: item.severity === "low" ? "weak" : "supported",
    next_action: "结合业务预算、出价和补充数据继续验证。",
  }));
  const evidenceRefs = moduleFindings.map((item) => item.evidence);
  const analysisConstraints = {
    data_boundary: "仅基于标准化数据和人机协作确认范围输出诊断，不补造原始数据。",
    unsupported_modules: request.unsupportedModules,
  };
  const diagnosisModel = {
    spec_version: "flow-agent.diagnosis-model.v1",
    generated_at: new Date().toISOString(),
    period: request.analysisPeriod,
    selected_modules: request.selectedModules,
    confirmed_supported_modules: modules,
    unsupported_modules: request.unsupportedModules,
    trend: trendDiagnosis,
    findings: {
      trend_diagnosis: trendDiagnosis,
      module_findings: moduleFindings,
      problem_hypotheses: problemHypotheses,
      diagnosis_summary: diagnosisSummary,
    },
    evidence: {
      evidence_refs: evidenceRefs,
      analysis_constraints: analysisConstraints,
    },
  };
  const diagnosisModelRef = buildFileRef("diagnosis-model.json", "diagnosis_model", diagnosisModel);
  return {
    jobFields: {
      diagnosis_summary: diagnosisSummary,
      trend_diagnosis: trendDiagnosis,
      module_findings: moduleFindings,
      problem_hypotheses: problemHypotheses,
      evidence_refs: evidenceRefs,
    },
    techFields: {
      analysis_constraints: analysisConstraints,
      missing_evidence_requests: [],
      diagnosis_model_ref: diagnosisModelRef,
      diagnosis_model: diagnosisModel,
    },
    trend_diagnosis: trendDiagnosis,
    module_findings: moduleFindings,
    problem_hypotheses: problemHypotheses,
    evidence_refs: evidenceRefs,
    analysis_constraints: analysisConstraints,
    diagnosis_summary: diagnosisSummary,
    missing_evidence_requests: [],
    diagnosis_model_ref: diagnosisModelRef,
    diagnosis_model: diagnosisModel,
    "fld-trend-diagnosis": trendDiagnosis,
    "fld-module-findings": moduleFindings,
    "fld-problem-hypotheses": problemHypotheses,
    "fld-evidence-refs": evidenceRefs,
    "fld-analysis-constraints": analysisConstraints,
    "fld-diagnosis-summary": diagnosisSummary,
    "fld-missing-evidence-requests": [],
    "fld-diagnosis-model-ref": diagnosisModelRef,
  };
}

function escapeHtml(value: unknown) {
  return toText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeReportRequest(payload: JsonRecord) {
  const diagnosisModel = getEmbeddedJson(pick(payload, "fld-report-model-ref", "report_model_ref", "diagnosis_model_ref", "fld-diagnosis-model-ref"))
    || (pick(payload, "diagnosis_model", "fld-diagnosis-model") as JsonRecord | undefined)
    || {};
  return {
    outputFormats: asArray<string>(pick(payload, "in-report-output-formats", "output_formats", "fld-output-formats")).length
      ? asArray<string>(pick(payload, "in-report-output-formats", "output_formats", "fld-output-formats"))
      : ["html"],
    analysisPeriod: (pick(payload, "in-report-analysis-period", "analysis_period", "fld-analysis-period") || {}) as JsonRecord,
    selectedModules: asArray<string>(pick(payload, "in-report-selected-modules", "selected_modules", "fld-selected-modules")),
    diagnosisSummary: (pick(payload, "in-report-diagnosis-summary", "diagnosis_summary", "fld-diagnosis-summary") || {}) as JsonRecord,
    trendDiagnosis: (pick(payload, "in-report-trend-diagnosis", "trend_diagnosis", "fld-trend-diagnosis") || {}) as JsonRecord,
    moduleFindings: asArray<JsonRecord>(pick(payload, "in-report-module-findings", "module_findings", "fld-module-findings")),
    problemHypotheses: asArray<JsonRecord>(pick(payload, "in-report-problem-hypotheses", "problem_hypotheses", "fld-problem-hypotheses")),
    diagnosisModel,
  };
}

function renderHtmlReport(model: JsonRecord) {
  const summary = isRecord(model.diagnosisSummary) ? model.diagnosisSummary : {};
  const trend = isRecord(model.trendDiagnosis) ? model.trendDiagnosis : {};
  const findings = asArray<JsonRecord>(model.moduleFindings);
  const hypotheses = asArray<JsonRecord>(model.problemHypotheses);
  const metrics = isRecord(trend.metrics) ? trend.metrics : {};
  const cards = [
    ["ROI", metrics.roi],
    ["CPC", metrics.cpc !== undefined ? `¥${money(metrics.cpc)}` : undefined],
    ["CTR", metrics.ctr !== undefined ? percent(metrics.ctr) : undefined],
    ["CVR", metrics.cvr !== undefined ? percent(metrics.cvr) : undefined],
  ];
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>广告复盘分析报告</title>
  <style>
    body{margin:0;background:#f7f4e8;color:#07111f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .page{max-width:1180px;margin:0 auto;padding:32px 24px 56px}
    .hero{border:1px solid #f1d887;background:#fff;border-radius:10px;padding:28px;box-shadow:0 10px 30px rgba(8,17,31,.06)}
    h1{margin:0;font-size:34px;line-height:1.15;letter-spacing:0}
    .muted{color:#827a68}.summary{font-size:18px;line-height:1.8;margin-top:16px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:22px 0}
    .card{background:#ffc857;border-radius:8px;padding:18px;min-height:92px}.card b{display:block;font-size:30px;margin-top:12px}
    section{background:#fff;border:1px solid #f1d887;border-radius:10px;padding:22px;margin-top:18px}
    h2{margin:0 0 16px;font-size:22px}.item{border-top:1px solid #eee2b6;padding:16px 0}.item:first-child{border-top:0}
    .tag{display:inline-block;border:1px solid #f1d887;border-radius:999px;padding:3px 10px;background:#fffbed;color:#7a5b00;font-size:13px;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;border-bottom:1px solid #eee2b6;padding:10px;vertical-align:top}
    @media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:28px}}
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="muted">广告复盘分析 · ${escapeHtml(model.periodLabel)}</div>
      <h1>投放复盘报告</h1>
      <p class="summary">${escapeHtml(toText(summary.summary || trend.summary || model.businessSummary || "本次复盘已完成。"))}</p>
      <div class="grid">${cards.map(([name, value]) => `<div class="card"><span>${escapeHtml(name)}</span><b>${escapeHtml(value ?? "-")}</b></div>`).join("")}</div>
    </header>
    <section>
      <h2>关键发现</h2>
      ${findings.map((item) => `<article class="item"><span class="tag">${escapeHtml(item.module || "模块")}</span><div>${escapeHtml(item.finding || item.conclusion || item.title || item)}</div></article>`).join("") || "<p class=\"muted\">暂无模块发现。</p>"}
    </section>
    <section>
      <h2>问题假设与建议动作</h2>
      <table><thead><tr><th>问题</th><th>假设</th><th>下一步</th></tr></thead><tbody>
      ${hypotheses.map((item) => `<tr><td>${escapeHtml(item.title || "问题假设")}</td><td>${escapeHtml(item.hypothesis || "")}</td><td>${escapeHtml(item.next_action || "")}</td></tr>`).join("") || "<tr><td colspan=\"3\">暂无问题假设。</td></tr>"}
      </tbody></table>
    </section>
  </main>
</body>
</html>`;
}

function buildWorkbookBuffer(reportModel: JsonRecord) {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { field: "business_summary", value: toText(reportModel.businessSummary) },
    { field: "period", value: toText(reportModel.periodLabel) },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(asArray<JsonRecord>(reportModel.moduleFindings)), "findings");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(asArray<JsonRecord>(reportModel.problemHypotheses)), "hypotheses");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

export async function runReportRenderer(payload: JsonRecord) {
  const request = normalizeReportRequest(payload);
  const diagnosisModel = isRecord(request.diagnosisModel) ? request.diagnosisModel : {};
  const generatedAt = new Date().toISOString();
  const periodLabelText = periodLabel(request.analysisPeriod);
  const reportModel = {
    spec_version: "flow-agent.report-model.v1",
    generated_at: generatedAt,
    periodLabel: periodLabelText,
    businessSummary: toText(request.diagnosisSummary.summary || pick(diagnosisModel, "summary"), "本次复盘已完成。"),
    diagnosisSummary: request.diagnosisSummary,
    trendDiagnosis: request.trendDiagnosis,
    moduleFindings: request.moduleFindings.length ? request.moduleFindings : asArray<JsonRecord>(pick(diagnosisModel, "module_findings")),
    problemHypotheses: request.problemHypotheses.length ? request.problemHypotheses : asArray<JsonRecord>(pick(diagnosisModel, "problem_hypotheses")),
    selectedModules: request.selectedModules,
  };
  const html = renderHtmlReport(reportModel);
  const xlsx = buildWorkbookBuffer(reportModel);
  const htmlBase64 = Buffer.from(html, "utf8").toString("base64");
  const xlsxBase64 = xlsx.toString("base64");
  const files = [];
  if (request.outputFormats.includes("html")) {
    files.push({
      format: "html",
      role: "html_report",
      file_name: "retail-ad-review-report.html",
      mime_type: "text/html",
      content_base64: htmlBase64,
      public_url: `data:text/html;base64,${htmlBase64}`,
    });
  }
  if (request.outputFormats.includes("excel")) {
    files.push({
      format: "excel",
      role: "excel_report",
      file_name: "retail-ad-review-report.xlsx",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content_base64: xlsxBase64,
      public_url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${xlsxBase64}`,
    });
  }
  const reportPackage = {
    status: "generated",
    formats: request.outputFormats,
    files,
    summary: "报告已生成。",
    generated_at: generatedAt,
    run_id: randomUUID(),
  };
  const reportModelRef = buildFileRef("report-model.json", "report_model", reportModel);
  const htmlReportFile = files.find((item) => item.format === "html") || null;
  const excelReportFile = files.find((item) => item.format === "excel") || null;
  const htmlReportUrl = typeof htmlReportFile?.public_url === "string" ? htmlReportFile.public_url : null;
  const excelReportUrl = typeof excelReportFile?.public_url === "string" ? excelReportFile.public_url : null;
  return {
    jobFields: {
      business_summary: reportModel.businessSummary,
      html_report_url: htmlReportUrl,
      excel_report_url: excelReportUrl,
      html_report_file: htmlReportFile,
      excel_report_file: excelReportFile,
    },
    techFields: {
      report_package: reportPackage,
      report_model_ref: reportModelRef,
      report_model: reportModel,
    },
    "fld-report-package": reportPackage,
    report_package: reportPackage,
    "fld-report-model-ref": reportModelRef,
    report_model_ref: reportModelRef,
    "fld-business-summary": reportModel.businessSummary,
    business_summary: reportModel.businessSummary,
    html_report_file: htmlReportFile,
    html_report_url: htmlReportUrl,
    excel_report_file: excelReportFile,
    excel_report_url: excelReportUrl,
    "fld-html-report-file": htmlReportFile,
    "fld-html-report-url": htmlReportUrl,
    "fld-excel-report-file": excelReportFile,
    "fld-excel-report-url": excelReportUrl,
  };
}

export function adapterErrorPayload(error: unknown) {
  if (error && typeof error === "object" && "payload" in error && isRecord((error as { payload: unknown }).payload)) {
    return (error as { payload: JsonRecord }).payload;
  }
  return {
    code: "RETAIL_AD_REVIEW_ADAPTER_FAILED",
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
}
