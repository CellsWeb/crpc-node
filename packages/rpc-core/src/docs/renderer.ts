/**
 * docs/renderer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-rendered HTML documentation generator.
 *
 * Design & Features:
 *  - Pure server-side rendering — dark theme with sidebar navigation.
 *  - 2-Column Side-by-Side Schema View:
 *    • Left Side: Human-readable required data/form fields with types (string, number, File/Binary) and descriptions.
 *    • Right Side: Raw JSON Schema code block.
 *  - Uniform Middleware Cards:
 *    • Name & clean static description.
 *    • "Properties & Controls:" Bullet list of option keys, values, and descriptions.
 *    • "Required Headers:" Bullet list of header keys and descriptions.
 *  - Central Middlewares Catalog (`/docs/middlewares/:name` & `/docs` catalog section).
 *  - Aggregated Required HTTP Headers contract for RPC functions.
 *  - cURL & JavaScript Fetch Snippet Generators.
 *  - Error Code Reference Guide.
 */

import { Value } from "@sinclair/typebox/value";
import type { TSchema } from "@sinclair/typebox";
import type { Registry, RegisteredFunction, RegisteredMiddleware } from "../registry";
import { ErrorCode } from "../errors";
import {
  isFileSchema,
  isFilesSchema,
  isFormNumSchema,
  isFormBoolSchema,
} from "../utils/typebox";

function normalizeDocsEndpoint(endpoint?: string): string {
  let cleaned = (endpoint ?? "/docs").trim();
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  if (cleaned.length > 1 && cleaned.endsWith("/")) cleaned = cleaned.slice(0, -1);
  return cleaned;
}

function typeboxToExample(schema?: any): unknown {
  if (!schema || typeof schema !== "object") return null;

  if (isFileSchema(schema)) return "(File)";
  if (isFilesSchema(schema)) return ["(File)"];
  if (isFormNumSchema(schema)) {
    const numVariant = Array.isArray(schema.anyOf) ? schema.anyOf.find((v: any) => v.type === "number") : null;
    return numVariant?.minimum ?? 1;
  }
  if (isFormBoolSchema(schema)) return true;

  if (schema.const !== undefined) return schema.const;
  if (schema.default !== undefined) return schema.default;

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return typeboxToExample(schema.anyOf[0]);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return typeboxToExample(schema.oneOf[0]);
  }

  if (schema.type === "string") return schema.pattern ? "123" : "example";
  if (schema.type === "number" || schema.type === "integer") return schema.minimum ?? 0;
  if (schema.type === "boolean") return true;
  if (schema.type === "array") return [typeboxToExample(schema.items) ?? "item"];

  if (schema.type === "object" || schema.properties) {
    const obj: Record<string, unknown> = {};
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries<any>(props)) {
      obj[k] = typeboxToExample(v);
    }
    return obj;
  }

  return "example";
}

function cleanSchemaForJsonDocs(schema?: any): unknown {
  if (!schema || typeof schema !== "object") return null;

  if (isFileSchema(schema)) {
    return {
      type: "string",
      format: "binary",
      description: schema.description ?? "Uploaded file",
      ...(schema.maxSizeBytes !== undefined ? { maxSizeBytes: schema.maxSizeBytes } : {}),
      ...(schema.mimeTypes !== undefined ? { mimeTypes: schema.mimeTypes } : {}),
    };
  }

  if (isFilesSchema(schema)) {
    return {
      type: "array",
      items: { type: "string", format: "binary" },
      description: schema.description ?? "Uploaded files array",
      ...(schema.maxCount !== undefined ? { maxCount: schema.maxCount } : {}),
      ...(schema.maxSizeBytes !== undefined ? { maxSizeBytes: schema.maxSizeBytes } : {}),
      ...(schema.mimeTypes !== undefined ? { mimeTypes: schema.mimeTypes } : {}),
    };
  }

  if (isFormNumSchema(schema)) {
    const numVariant = Array.isArray(schema.anyOf) ? schema.anyOf.find((v: any) => v.type === "number") : null;
    return {
      type: "number",
      ...(numVariant?.minimum !== undefined ? { minimum: numVariant.minimum } : {}),
      ...(numVariant?.maximum !== undefined ? { maximum: numVariant.maximum } : {}),
      ...(numVariant?.exclusiveMinimum !== undefined ? { exclusiveMinimum: numVariant.exclusiveMinimum } : {}),
      ...(numVariant?.exclusiveMaximum !== undefined ? { exclusiveMaximum: numVariant.exclusiveMaximum } : {}),
      ...(numVariant?.multipleOf !== undefined ? { multipleOf: numVariant.multipleOf } : {}),
      description: schema.description ?? "FormNum (accepts number or numeric string)",
    };
  }

  if (isFormBoolSchema(schema)) {
    return {
      type: "boolean",
      description: schema.description ?? "FormBool (accepts boolean or boolean string)",
    };
  }

  if (Array.isArray(schema)) {
    return schema.map(cleanSchemaForJsonDocs);
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(schema)) {
    const val = schema[key];
    if (typeof val === "function") continue;
    if (key === "properties" && typeof val === "object" && val !== null) {
      const props: Record<string, any> = {};
      for (const [pKey, pVal] of Object.entries<any>(val)) {
        props[pKey] = cleanSchemaForJsonDocs(pVal);
      }
      result.properties = props;
    } else if (key === "items" && typeof val === "object" && val !== null) {
      result.items = cleanSchemaForJsonDocs(val);
    } else if ((key === "anyOf" || key === "oneOf" || key === "allOf") && Array.isArray(val)) {
      result[key] = val.map(cleanSchemaForJsonDocs);
    } else {
      result[key] = val;
    }
  }

  return result;
}

function typeboxToJsonSchemaObject(schema?: TSchema): unknown {
  if (!schema) return null;
  try {
    return cleanSchemaForJsonDocs(schema);
  } catch {
    return null;
  }
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --surface-hover: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --accent: #58a6ff;
    --accent-dim: rgba(56, 139, 253, 0.15);
    --green: #3fb950;
    --green-dim: rgba(63, 185, 80, 0.15);
    --yellow: #d29922;
    --red: #f85149;
    --purple: #bc8cff;
    --code-bg: #161b22;
    --tag-bg: #21262d;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .layout { display: flex; min-height: 100vh; }
  .sidebar {
    width: 280px; min-width: 280px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 24px 0;
    position: sticky; top: 0; height: 100vh;
    overflow-y: auto;
  }
  .sidebar-header {
    padding: 0 20px 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .sidebar-logo {
    font-size: 15px; font-weight: 700; color: var(--text);
    display: flex; align-items: center; gap: 8px;
    letter-spacing: -0.02em;
  }
  .sidebar-logo-badge {
    background: var(--accent-dim); color: var(--accent);
    font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;
  }
  .sidebar-ns {
    padding: 12px 20px 4px; font-size: 11px; font-weight: 700;
    color: var(--muted); text-transform: uppercase; letter-spacing: .08em;
  }
  .sidebar-fn {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 20px 7px 28px;
    color: var(--text); font-size: 13px; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace;
    transition: background .12s ease;
  }
  .sidebar-fn:hover { background: var(--surface-hover); text-decoration: none; }
  .sidebar-fn.active { color: var(--accent); background: var(--accent-dim); font-weight: 600; }
  .sidebar-fn-badge {
    font-size: 10px; padding: 1px 5px; border-radius: 3px;
    background: var(--tag-bg); color: var(--muted); border: 1px solid var(--border);
    font-family: sans-serif;
  }
  .main { flex: 1; padding: 40px 48px; max-width: 1040px; }
  .page-header { margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 24px; }
  .page-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 8px; }
  .page-title { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; }
  .page-sub { color: var(--muted); font-size: 15px; }
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 12px;
    font-size: 11px; font-weight: 600; letter-spacing: .03em;
  }
  .badge-green { background: var(--green-dim); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.3); }
  .badge-yellow { background: rgba(210, 153, 34, 0.15); color: var(--yellow); border: 1px solid rgba(210, 153, 34, 0.3); }
  .badge-purple { background: rgba(188, 140, 255, 0.15); color: var(--purple); border: 1px solid rgba(188, 140, 255, 0.3); }
  .badge-gray { background: var(--tag-bg); color: var(--muted); border: 1px solid var(--border); }
  .section { margin-bottom: 36px; }
  .section-title {
    font-size: 12px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: .08em;
    margin-bottom: 14px; padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-stack { display: flex; flex-direction: column; gap: 16px; }
  .mw-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 18px 20px; transition: border-color .15s;
  }
  .mw-card:hover { border-color: var(--accent); }
  .mw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .mw-name { font-size: 15px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; color: var(--accent); }
  .mw-desc { color: var(--text); font-size: 13.5px; margin-bottom: 14px; }
  .mw-sub-title { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-top: 12px; margin-bottom: 6px; }
  .mw-list { list-style: none; padding: 0; margin: 0; }
  .mw-list-item { font-size: 13px; color: var(--text); margin-bottom: 4px; display: flex; align-items: baseline; gap: 6px; }
  .mw-list-bullet { color: var(--accent); font-weight: bold; }
  .mw-prop-key { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; font-weight: 600; color: var(--accent); }
  .mw-prop-val { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; font-weight: 600; color: var(--text); background: var(--tag-bg); padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border); }
  .mw-prop-desc { color: var(--muted); font-size: 12.5px; }

  /* 2-Column Split View Grid */
  .split-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; width: 100%; }
  @media (max-width: 860px) {
    .split-grid { grid-template-columns: 1fr; }
  }
  .split-panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 18px; display: flex; flex-direction: column;
    min-width: 0; width: 100%; overflow-x: auto;
  }
  .split-panel-title {
    font-size: 11px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px;
    padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }

  .fn-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 18px 22px; margin-bottom: 14px;
    transition: border-color .15s, background .15s;
  }
  .fn-card:hover { border-color: var(--accent); background: var(--surface-hover); }
  .fn-card-name { font-size: 16px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; color: var(--text); }
  .fn-card-desc { color: var(--muted); margin-top: 4px; font-size: 13.5px; }
  .fn-card-meta { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .code-block-wrap { position: relative; margin-top: 4px; flex: 1; min-width: 0; width: 100%; overflow-x: auto; }
  .code-block {
    background: var(--code-bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px; overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace;
    font-size: 12px; line-height: 1.6; color: #adbac7;
    white-space: pre; height: 100%; max-width: 100%;
  }
  .copy-btn {
    position: absolute; top: 8px; right: 8px;
    background: var(--tag-bg); border: 1px solid var(--border);
    color: var(--muted); border-radius: 6px;
    padding: 3px 8px; font-size: 11px; cursor: pointer;
    transition: all .15s;
  }
  .copy-btn:hover { background: var(--border); color: var(--text); }
  .copy-btn.copied { color: var(--green); border-color: var(--green); }
  .tag {
    background: var(--tag-bg); border: 1px solid var(--border);
    color: var(--muted); border-radius: 4px;
    padding: 2px 8px; font-size: 11px;
  }
  .info-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .search-bar {
    width: 100%; background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 16px; color: var(--text);
    font-size: 14px; margin-bottom: 24px; outline: none; transition: border-color .15s;
  }
  .search-bar:focus { border-color: var(--accent); }
  .ns-header { font-size: 18px; font-weight: 700; margin: 32px 0 14px; letter-spacing: -0.01em; }
  .ns-header:first-child { margin-top: 0; }
  .empty { color: var(--muted); font-size: 14px; padding: 40px 0; text-align: center; }
  .header-table {
    width: 100%; border-collapse: collapse; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
  }
  .header-table th {
    background: var(--code-bg); padding: 10px 14px; text-align: left;
    font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;
    letter-spacing: .06em; border-bottom: 1px solid var(--border);
  }
  .header-table td {
    padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border);
  }
  .header-table tr:last-child td { border-bottom: none; }
  .header-key { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; font-weight: 600; color: var(--accent); }
`;

const COPY_SCRIPT = `
<script>
function copyCode(btn) {
  const block = btn.previousElementSibling;
  navigator.clipboard.writeText(block.textContent).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}
</script>
`;

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeBlock(content: string): string {
  return `<div class="code-block-wrap">
    <pre class="code-block">${escHtml(content)}</pre>
    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
  </div>`;
}

function groupFunctionsByNamespace(registry: Registry): Record<string, RegisteredFunction[]> {
  const grouped: Record<string, RegisteredFunction[]> = {};
  for (const fn of registry.functions.values()) {
    if (fn.metadata?.hideFromDocs === true) continue;
    grouped[fn.namespace] ??= [];
    grouped[fn.namespace].push(fn);
  }
  for (const ns of Object.keys(grouped)) {
    grouped[ns].sort((a, b) => a.functionName.localeCompare(b.functionName));
  }
  return grouped;
}

function buildSidebar(registry: Registry, activeKey?: string, docsEndpoint = "/docs"): string {
  const normDocs = normalizeDocsEndpoint(docsEndpoint);
  const grouped = groupFunctionsByNamespace(registry);
  const sortedNs = Object.keys(grouped).sort();
  let out = "";

  for (const ns of sortedNs) {
    out += `<div class="sidebar-ns">${escHtml(ns)}</div>`;
    for (const fn of grouped[ns]) {
      const isActive = fn.key === activeKey;
      const isJson = fn.contentType === "application/json";
      const badgeText = isJson ? "JSON" : "FORM";
      out += `
        <a class="sidebar-fn${isActive ? " active" : ""}" href="${normDocs}/${escHtml(fn.namespace.replace(/\./g, "/"))}/${escHtml(fn.functionName)}">
          <span>${escHtml(fn.functionName)}</span>
          <span class="sidebar-fn-badge">${badgeText}</span>
        </a>`;
    }
  }

  const middlewares = Array.from(registry.middlewares.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (middlewares.length > 0) {
    out += `<div class="sidebar-ns" style="margin-top:20px;border-top:1px solid var(--border);padding-top:12px">Middlewares</div>`;
    for (const mw of middlewares) {
      const isActive = activeKey === `mw:${mw.name}`;
      out += `
        <a class="sidebar-fn${isActive ? " active" : ""}" href="${normDocs}/middlewares/${escHtml(mw.name)}">
          <span>⚡ ${escHtml(mw.name)}</span>
          <span class="sidebar-fn-badge">MW</span>
        </a>`;
    }
  }

  return out || `<div class="sidebar-fn" style="color:var(--muted)">No functions loaded</div>`;
}

function htmlShell(title: string, bodyContent: string, sidebarHtml: string, docsEndpoint = "/docs"): string {
  const normDocs = normalizeDocsEndpoint(docsEndpoint);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-header">
      <a href="${normDocs}" style="text-decoration:none">
        <div class="sidebar-logo">
          <span>CellsWeb RPC</span>
          <span class="sidebar-logo-badge">DOCS</span>
        </div>
      </a>
    </div>
    ${sidebarHtml}
  </nav>
  <main class="main">
    ${bodyContent}
  </main>
</div>
${COPY_SCRIPT}
</body>
</html>`;
}

function formatSchemaType(schema: any): string {
  if (!schema || typeof schema !== "object") return "any";

  if (isFileSchema(schema)) return "File / Binary";
  if (isFilesSchema(schema)) return "File[] / Binary[]";
  if (isFormNumSchema(schema)) return "number";
  if (isFormBoolSchema(schema)) return "boolean";

  if (schema.format === "binary") return "File / Binary";

  if (schema.type === "array") {
    const itemType = formatSchemaType(schema.items);
    return `${itemType}[]`;
  }

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }

  const variants = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(variants) && variants.length > 0) {
    const types = variants.map((v: any) => formatSchemaType(v));
    const uniqueTypes = Array.from(new Set(types));
    return uniqueTypes.join(" | ");
  }

  if (typeof schema.type === "string") {
    return schema.type;
  }

  return "any";
}

function renderSchemaFieldsList(schemaObj: any, indent = 0): string {
  if (!schemaObj || typeof schemaObj !== "object") return '<div style="color:var(--muted);font-size:12.5px">• Any payload allowed</div>';

  const props = schemaObj.properties ?? {};
  const requiredList: string[] = schemaObj.required ?? [];
  const propKeys = Object.keys(props);

  if (propKeys.length === 0) {
    return '<div style="color:var(--muted);font-size:12.5px">• No fields specified (empty object)</div>';
  }

  const items = propKeys.map((key) => {
    const pSchema = props[key] ?? {};
    const isRequired = requiredList.includes(key);
    const typeStr = formatSchemaType(pSchema);
    const desc = pSchema.description ?? pSchema.title ?? "";

    let nestedHtml = "";
    if (pSchema.type === "object" && pSchema.properties) {
      nestedHtml = `<div style="margin-left:14px;margin-top:4px">${renderSchemaFieldsList(pSchema, indent + 1)}</div>`;
    } else if (pSchema.type === "array" && pSchema.items?.properties) {
      nestedHtml = `<div style="margin-left:14px;margin-top:4px">${renderSchemaFieldsList(pSchema.items, indent + 1)}</div>`;
    }

    return `<li class="mw-list-item" style="display:block;margin-bottom:6px">
      <div style="display:flex;align-items:baseline;gap:6px">
        <span class="mw-list-bullet">•</span>
        <span class="mw-prop-key">${escHtml(key)}</span>
        <span style="font-size:11px;color:var(--muted)">(${escHtml(typeStr)}, ${isRequired ? '<strong style="color:var(--accent)">required</strong>' : "optional"})</span>
        ${desc ? ` <span class="mw-prop-desc">— ${escHtml(desc)}</span>` : ""}
      </div>
      ${nestedHtml}
    </li>`;
  });

  return `<ul class="mw-list">${items.join("")}</ul>`;
}

function render2ColumnSchemaSection(
  sectionTitle: string,
  jsonSchemaObj: any,
  contentType: string,
): string {
  if (!jsonSchemaObj) {
    return `
      <div class="section">
        <div class="section-title">${escHtml(sectionTitle)}</div>
        <div style="color:var(--muted);font-size:13px">No schema defined.</div>
      </div>
    `;
  }

  const isMultipart = contentType === "multipart/form-data";
  const leftLabel = isMultipart ? "Form Fields & File Uploads" : "Required Data Fields";
  const fieldsListHtml = renderSchemaFieldsList(jsonSchemaObj);
  const rawJsonSchema = JSON.stringify(jsonSchemaObj, null, 2);

  return `
    <div class="section">
      <div class="section-title">${escHtml(sectionTitle)}</div>
      <div class="split-grid">
        <div class="split-panel">
          <div class="split-panel-title">${escHtml(leftLabel)}</div>
          ${fieldsListHtml}
        </div>
        <div class="split-panel">
          <div class="split-panel-title">JSON Schema</div>
          ${codeBlock(rawJsonSchema)}
        </div>
      </div>
    </div>
  `;
}

function renderMiddlewareCardContent(
  mwName: string,
  rawDescription: string,
  optsConfigured: Record<string, unknown> | undefined,
  centralMw: RegisteredMiddleware | undefined,
  isGlobalView = false,
): string {
  const optsSchemaObj = typeboxToJsonSchemaObject(centralMw?.optionsSchema) as any;
  const headersSchemaObj = typeboxToJsonSchemaObject(centralMw?.headersSchema) as any;

  const optProps = optsSchemaObj?.properties ?? {};
  const headerProps = headersSchemaObj?.properties ?? {};

  // 1. Properties & Controls List
  let propsListHtml = "";
  const propKeys = Object.keys(optProps);
  if (propKeys.length > 0) {
    const items = propKeys.map((key) => {
      const pSchema = optProps[key] ?? {};
      const desc = pSchema.description ?? pSchema.title ?? "";
      const defaultVal = pSchema.default !== undefined ? JSON.stringify(pSchema.default) : undefined;
      const configuredVal = optsConfigured?.[key] !== undefined ? JSON.stringify(optsConfigured[key]) : undefined;

      let displayVal = configuredVal;
      let isDefaultTag = false;
      if (displayVal === undefined) {
        displayVal = defaultVal ?? "-";
        isDefaultTag = isGlobalView && defaultVal !== undefined;
      }

      return `<li class="mw-list-item">
        <span class="mw-list-bullet">•</span>
        <span class="mw-prop-key">${escHtml(key)}:</span>
        <span class="mw-prop-val">${escHtml(displayVal)}${isDefaultTag ? ' <span style="font-size:10px;color:var(--muted)">(default)</span>' : ''}</span>
        ${desc ? ` <span class="mw-prop-desc">— ${escHtml(desc)}</span>` : ""}
      </li>`;
    });
    propsListHtml = `<ul class="mw-list">${items.join("")}</ul>`;
  } else {
    propsListHtml = `<div style="color:var(--muted);font-size:12.5px;margin-top:4px">• None (No configurable options)</div>`;
  }

  // 2. Required Headers List
  let headersListHtml = "";
  const headerKeys = Object.keys(headerProps);
  if (headerKeys.length > 0) {
    const items = headerKeys.map((key) => {
      const hSchema = headerProps[key] ?? {};
      const desc = hSchema.description ?? hSchema.title ?? "HTTP Header value";
      return `<li class="mw-list-item">
        <span class="mw-list-bullet">•</span>
        <span class="mw-prop-key">${escHtml(key)}</span>
        <span class="mw-prop-desc">— ${escHtml(desc)}</span>
      </li>`;
    });
    headersListHtml = `<ul class="mw-list">${items.join("")}</ul>`;
  } else {
    headersListHtml = `<div style="color:var(--muted);font-size:12.5px;margin-top:4px">• None (No headers required)</div>`;
  }

  return `
    <div class="mw-card">
      <div class="mw-header">
        <a href="/docs/middlewares/${escHtml(mwName)}" style="text-decoration:none"><div class="mw-name">⚡ ${escHtml(mwName)}</div></a>
      </div>
      <div class="mw-desc">${escHtml(rawDescription)}</div>
      
      <div class="mw-sub-title">Properties & Controls:</div>
      ${propsListHtml}

      <div class="mw-sub-title">Required Headers:</div>
      ${headersListHtml}
    </div>
  `;
}

export function renderDocsIndex(
  registry: Registry,
  serverUrl = "",
  rpcEndpoint = "/rpc",
  docsEndpoint = "/docs",
): string {
  const normDocs = normalizeDocsEndpoint(docsEndpoint);
  const grouped = groupFunctionsByNamespace(registry);
  const sortedNs = Object.keys(grouped).sort();
  const totalFns = Object.values(grouped).reduce((count, functions) => count + functions.length, 0);
  const cleanServer = serverUrl.replace(/\/$/, "");
  const cleanRpc = rpcEndpoint.startsWith("/") ? rpcEndpoint : `/${rpcEndpoint}`;
  const endpointBadge = cleanServer
    ? `<div style="margin-top:8px"><span class="badge badge-purple" style="font-family:ui-monospace, SFMono-Regular, monospace;font-size:12px;padding:4px 10px;">POST ${escHtml(cleanServer + cleanRpc)}</span></div>`
    : "";

  let body = `
    <div class="page-header">
      <div class="page-title">API Documentation</div>
      <div class="page-sub">${totalFns} function${totalFns !== 1 ? "s" : ""} across ${sortedNs.length} namespace${sortedNs.length !== 1 ? "s" : ""}</div>
      ${endpointBadge}
    </div>
    <input class="search-bar" type="search" placeholder="Search functions, namespaces, or middlewares..." oninput="filterFns(this.value)" id="search-input">
    <div id="fn-list">
  `;

  if (sortedNs.length === 0) {
    body += `<div class="empty">No functions registered yet.<br>Add folders to <code>src/functions/{namespace}/{functionName}/</code></div>`;
  }

  for (const ns of sortedNs) {
    body += `<div class="ns-header" data-ns="${escHtml(ns)}">${escHtml(ns)}</div>`;
    for (const fn of grouped[ns]) {
      const metadata = fn.metadata ?? {};
      const tags = (metadata.tags ?? [])
        .map((t) => `<span class="tag">${escHtml(t)}</span>`)
        .join(" ");

      const mwNames = fn.middlewares.map((m) => m.name).join(", ");
      const mwSubtitle = mwNames ? `Middlewares: ${mwNames}` : "No middleware";

      body += `
        <a href="${normDocs}/${escHtml(fn.namespace.replace(/\./g, "/"))}/${escHtml(fn.functionName)}" style="text-decoration:none;display:block;">
          <div class="fn-card" data-name="${escHtml(fn.functionName)}" data-ns="${escHtml(ns)}">
            <div class="fn-card-name">${escHtml(fn.functionName)}</div>
            ${metadata.description ? `<div class="fn-card-desc">${escHtml(metadata.description)}</div>` : ""}
            <div class="fn-card-meta">
              ${metadata.isPublic ? '<span class="badge badge-green">PUBLIC</span>' : '<span class="badge badge-gray">PRIVATE</span>'}
              ${metadata.deprecated ? '<span class="badge badge-yellow">DEPRECATED</span>' : ""}
              <span class="badge badge-purple">${escHtml(fn.contentType)}</span>
              <span class="badge badge-gray">${escHtml(mwSubtitle)}</span>
              ${tags}
            </div>
          </div>
        </a>
      `;
    }
  }

  body += `</div>`;

  // Central Middlewares Catalog Section on Index Page
  const middlewares = Array.from(registry.middlewares.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (middlewares.length > 0) {
    body += `
      <div style="margin-top:48px;border-top:1px solid var(--border);padding-top:32px">
        <div style="font-size:20px;font-weight:700;margin-bottom:8px">⚡ Central Middlewares Catalog (${middlewares.length})</div>
        <p style="color:var(--muted);font-size:13.5px;margin-bottom:20px">
          Middlewares process incoming requests, enforce security policies, validate headers, and inject context before functions run.
        </p>
        <div class="card-stack">
    `;

    for (const mw of middlewares) {
      const rawDesc = mw.metadata?.description ?? `Custom ${mw.name} middleware`;
      body += renderMiddlewareCardContent(mw.name, rawDesc, undefined, mw, true);
    }

    body += `</div></div>`;
  }

  // Error Reference Section
  const errorExample = JSON.stringify(
    {
      status: "error",
      code: "validation_error",
      message: "Input validation failed: email — Invalid email address",
      meta: {
        durationMs: 1.84,
        requestId: "clx123abc456",
      },
    },
    null,
    2,
  );

  const errorCodes: Array<{ code: ErrorCode; when: string }> = [
    { code: ErrorCode.INVALID_CONTENT_TYPE, when: "Content-Type is missing or not application/json or multipart/form-data" },
    { code: ErrorCode.INVALID_BODY, when: "Missing, malformed, or empty request body (namespace, functionName, data)" },
    { code: ErrorCode.FUNCTION_NOT_FOUND, when: "The requested function is not registered in the RPC server" },
    { code: ErrorCode.VALIDATION_ERROR, when: "Input data failed the function's TypeBox inputSchema validation" },
    { code: ErrorCode.UNAUTHORIZED, when: "Auth middleware rejected credentials or authorization token" },
    { code: ErrorCode.FORBIDDEN, when: "User is authenticated but lacks required role or permission" },
    { code: ErrorCode.RATE_LIMITED, when: "Caller exceeded configured rate limits (windowSeconds / maxRequests)" },
    { code: ErrorCode.SCHEMA_MISMATCH, when: "Function output failed outputSchema contract — server implementation bug" },
    { code: ErrorCode.PAYLOAD_TOO_LARGE, when: "Request body or uploaded file size exceeds maximum limits" },
    { code: ErrorCode.TIMEOUT, when: "Function execution exceeded configured timeout threshold" },
    { code: ErrorCode.INTERNAL_ERROR, when: "Internal unhandled error or missing middleware registration" },
  ];

  const errorCodeRows = errorCodes
    .map(
      ({ code, when }) => `
      <tr>
        <td style="padding:8px 12px;font-family:ui-monospace, SFMono-Regular, monospace;font-size:13px;color:var(--accent);white-space:nowrap">${escHtml(code)}</td>
        <td style="padding:8px 12px;font-size:13px;color:var(--muted)">${escHtml(when)}</td>
      </tr>`,
    )
    .join("");

  body += `
    <div class="section" style="margin-top:48px;border-top:1px solid var(--border);padding-top:32px">
      <div style="font-size:20px;font-weight:700;margin-bottom:8px">⚠ Error Reference</div>
      <p style="color:var(--muted);font-size:13.5px;margin-bottom:20px">
        The HTTP status is always <strong style="color:var(--text)">200</strong>.
        Error information lives entirely in the JSON response body. Check <code>status === "error"</code>
        and branch on <code>code</code> to handle specific failure modes.
      </p>

      <div class="section-title">Error Response Example</div>
      ${codeBlock(errorExample)}

      <div class="section-title" style="margin-top:24px">Error Code Enum</div>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--code-bg)">
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">code</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">When it fires</th>
            </tr>
          </thead>
          <tbody>
            ${errorCodeRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search JS
  body += `
    <script>
    function filterFns(query) {
      if (!query) {
        document.querySelectorAll('.fn-card, .mw-card').forEach(c => (c.parentElement || c).style.display = '');
        document.querySelectorAll('.ns-header').forEach(h => h.style.display = '');
        return;
      }
      
      let regex;
      try {
        regex = new RegExp(query, 'i');
      } catch (e) {
        regex = new RegExp(query.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&'), 'i');
      }

      const fuzzyPattern = query.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&').split('').join('.*?');
      const fuzzyRegex = new RegExp(fuzzyPattern, 'i');

      const nsMatched = new Set();
      const fnMatchedNs = new Set();
      const cards = Array.from(document.querySelectorAll('.fn-card'));

      cards.forEach(card => {
        const name = card.dataset.name || '';
        const ns = card.dataset.ns || '';
        const isNsMatch = regex.test(ns) || fuzzyRegex.test(ns);
        const isFnMatch = regex.test(name) || fuzzyRegex.test(name);
        if (isNsMatch) nsMatched.add(ns);
        if (isFnMatch) fnMatchedNs.add(ns);
      });

      cards.forEach(card => {
        const name = card.dataset.name || '';
        const ns = card.dataset.ns || '';
        const isFnMatch = regex.test(name) || fuzzyRegex.test(name);
        let show = false;
        if (fnMatchedNs.has(ns)) {
          if (isFnMatch) show = true;
        } else if (nsMatched.has(ns)) {
          show = true;
        }
        card.parentElement.style.display = show ? '' : 'none';
      });

      document.querySelectorAll('.ns-header').forEach(header => {
        const ns = header.dataset.ns || '';
        const hasVisibleChild = cards.some(c => c.dataset.ns === ns && c.parentElement.style.display !== 'none');
        header.style.display = hasVisibleChild ? '' : 'none';
      });
    }
    </script>
  `;

  return htmlShell("API Documentation", body, buildSidebar(registry, undefined, normDocs), normDocs);
}

export function renderMiddlewareDoc(
  registry: Registry,
  mw: RegisteredMiddleware,
  docsEndpoint = "/docs",
): string {
  const normDocs = normalizeDocsEndpoint(docsEndpoint);
  const rawDesc = mw.metadata?.description ?? `Custom ${mw.name} middleware`;

  const headersSchemaObj = typeboxToJsonSchemaObject(mw.headersSchema);
  const optionsSchemaObj = typeboxToJsonSchemaObject(mw.optionsSchema);

  let body = `
    <div class="page-header">
      <div class="page-breadcrumb">
        <a href="${normDocs}">← All functions & middlewares</a>
        <span>/</span>
        <span>middlewares</span>
      </div>
      <div class="page-title">⚡ ${escHtml(mw.name)}</div>
      <div class="page-sub">${escHtml(rawDesc)}</div>
      <div class="info-row" style="margin-top:14px">
        <span class="badge badge-purple">CENTRAL MIDDLEWARE</span>
      </div>
    </div>
  `;

  body += `<div class="section"><div class="section-title">Middleware Specification</div>`;
  body += renderMiddlewareCardContent(mw.name, rawDesc, undefined, mw, true);
  body += `</div>`;

  if (optionsSchemaObj) {
    body += `
      <div class="section">
        <div class="section-title">Options JSON Schema</div>
        ${codeBlock(JSON.stringify(optionsSchemaObj, null, 2))}
      </div>
    `;
  }

  if (headersSchemaObj) {
    body += `
      <div class="section">
        <div class="section-title">Required Headers JSON Schema</div>
        ${codeBlock(JSON.stringify(headersSchemaObj, null, 2))}
      </div>
    `;
  }

  return htmlShell(`⚡ ${mw.name} — Middleware Docs`, body, buildSidebar(registry, `mw:${mw.name}`, normDocs), normDocs);
}

export function renderFunctionDoc(
  registry: Registry,
  fn: RegisteredFunction,
  serverUrl: string,
  rpcEndpoint = "/rpc",
  docsEndpoint = "/docs",
): string {
  if (fn.metadata?.hideFromDocs === true) {
    return renderDocsIndex(registry, serverUrl, rpcEndpoint, docsEndpoint);
  }
  const normDocs = normalizeDocsEndpoint(docsEndpoint);
  const cleanServer = serverUrl.replace(/\/$/, "");
  const cleanRpc = rpcEndpoint.startsWith("/") ? rpcEndpoint : `/${rpcEndpoint}`;
  const fullRpcUrl = `${cleanServer}${cleanRpc}`;

  const metadata = fn.metadata ?? {};

  const inputExample = typeboxToExample(fn.inputSchema);
  const outputExample = typeboxToExample(fn.outputSchema);
  const inputJsonSchema = typeboxToJsonSchemaObject(fn.inputSchema);
  const outputJsonSchema = typeboxToJsonSchemaObject(fn.outputSchema);

  const requestExample = {
    namespace: fn.namespace,
    functionName: fn.functionName,
    data: inputExample ?? {},
  };

  const responseExample = {
    status: "ok",
    data: outputExample ?? {},
    meta: {
      requestId: "clx123abc456",
      durationMs: 1.42,
    },
  };

  const tags = (metadata.tags ?? [])
    .map((t) => `<span class="tag">${escHtml(t)}</span>`)
    .join(" ");

  // DYNAMICALLY INSPECT MIDDLEWARES & PARAMETERS
  const middlewareCards: string[] = [];
  const requiredHeadersMap = new Map<string, { description?: string; requiredBy: string[] }>();

  for (const mwItem of fn.middlewares) {
    const centralMw = registry.middlewares.get(mwItem.name);
    const optsObj = mwItem.options ?? {};
    const rawDesc = centralMw?.metadata?.description ?? `Custom ${mwItem.name} middleware`;

    middlewareCards.push(renderMiddlewareCardContent(mwItem.name, rawDesc, optsObj, centralMw, false));

    // Collect headers required by this middleware
    if (centralMw?.headersSchema) {
      const schemaObj = typeboxToJsonSchemaObject(centralMw.headersSchema) as any;
      const headersProps = schemaObj?.properties ?? {};

      for (const [headerKey, propSchema] of Object.entries<any>(headersProps)) {
        const keyLower = headerKey.toLowerCase();
        const existing = requiredHeadersMap.get(keyLower) ?? { requiredBy: [] };
        if (!existing.requiredBy.includes(mwItem.name)) {
          existing.requiredBy.push(mwItem.name);
        }
        existing.description = propSchema?.description ?? existing.description;
        requiredHeadersMap.set(keyLower, existing);
      }
    }
  }

  // Generate cURL command
  const curlHeaders = Array.from(requiredHeadersMap.keys())
    .map((h) => `-H "${h}: <YOUR_${h.toUpperCase().replace(/-/g, "_")}>"`)
    .join(" \\\n  ");

  const curlCmd =
    fn.contentType === "multipart/form-data"
      ? `curl -X POST "${fullRpcUrl}" \\
  -F "namespace=${fn.namespace}" \\
  -F "functionName=${fn.functionName}" \\
  -F "title=Example Title" \\
  -F "file=@/path/to/file.jpg"`
      : `curl -X POST "${fullRpcUrl}" \\
  -H "Content-Type: application/json" \\
  ${curlHeaders ? curlHeaders + " \\\n  " : ""}-d '${JSON.stringify(requestExample, null, 2)}'`;

  let body = `
    <div class="page-header">
      <div class="page-breadcrumb">
        <a href="${normDocs}">← All functions</a>
        <span>/</span>
        <span>${escHtml(fn.namespace)}</span>
      </div>
      <div class="page-title">${escHtml(fn.functionName)}</div>
      ${metadata.description ? `<div class="page-sub">${escHtml(metadata.description)}</div>` : ""}
      <div class="info-row" style="margin-top:14px">
        ${metadata.isPublic ? '<span class="badge badge-green">PUBLIC</span>' : '<span class="badge badge-gray">PRIVATE</span>'}
        ${metadata.deprecated ? '<span class="badge badge-yellow">DEPRECATED</span>' : ""}
        <span class="badge badge-purple">${escHtml(fn.contentType)}</span>
        ${tags}
      </div>
    </div>
  `;

  if (metadata.deprecated) {
    body += `<div style="background:rgba(210, 153, 34, 0.15);border:1px solid rgba(210, 153, 34, 0.3);border-radius:8px;padding:12px 16px;color:var(--yellow);margin-bottom:24px;font-size:13px">⚠️ This function is deprecated and may be removed in a future version.</div>`;
  }

  // 1. DYNAMIC MIDDLEWARE PIPELINE SECTION
  body += `
    <div class="section">
      <div class="section-title">
        <span>Middleware Pipeline & Applied Controls (${fn.middlewares.length})</span>
      </div>
      ${
        middlewareCards.length > 0
          ? `<div class="card-stack">${middlewareCards.join("")}</div>`
          : `<div style="color:var(--muted);font-size:13.5px">No middlewares attached to this function. Executing directly.</div>`
      }
    </div>
  `;

  // 2. DYNAMIC REQUIRED HEADERS SECTION
  if (requiredHeadersMap.size > 0) {
    const headerRows = Array.from(requiredHeadersMap.entries())
      .map(([key, info]) => `
        <tr>
          <td class="header-key">${escHtml(key)}</td>
          <td>${info.requiredBy.map((mw) => `<span class="badge badge-purple">⚡ ${escHtml(mw)}</span>`).join(" ")}</td>
          <td style="color:var(--muted);font-size:12.5px">${escHtml(info.description ?? "HTTP Header value required by middleware")}</td>
        </tr>
      `)
      .join("");

    body += `
      <div class="section">
        <div class="section-title">Required HTTP Headers</div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:12px">
          These HTTP headers are consumed by attached middlewares before reaching your function logic.
        </div>
        <table class="header-table">
          <thead>
            <tr>
              <th>Header Key</th>
              <th>Required By</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${headerRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // 3. cURL CLI SNIPPET
  body += `
    <div class="section">
      <div class="section-title">Terminal cURL Command</div>
      ${codeBlock(curlCmd)}
    </div>
  `;

  // 4. Request & Response Payload Examples
  body += `
    <div class="section">
      <div class="section-title">Request Payload Example</div>
      <div style="color:var(--muted);font-size:12px;margin-bottom:8px">POST ${escHtml(fullRpcUrl)} &nbsp;·&nbsp; Content-Type: ${escHtml(fn.contentType)}</div>
      ${codeBlock(JSON.stringify(requestExample, null, 2))}
    </div>

    <div class="section">
      <div class="section-title">Response Payload Example</div>
      ${codeBlock(JSON.stringify(responseExample, null, 2))}
    </div>
  `;

  // 5. 2-COLUMN SPLIT VIEW FOR INPUT SCHEMA
  if (inputJsonSchema) {
    body += render2ColumnSchemaSection("Input Data Contract", inputJsonSchema, fn.contentType);
  }

  // 6. 2-COLUMN SPLIT VIEW FOR OUTPUT SCHEMA
  if (outputJsonSchema) {
    body += render2ColumnSchemaSection("Output Data Contract", outputJsonSchema, "application/json");
  }

  return htmlShell(`${fn.functionName} — API Docs`, body, buildSidebar(registry, fn.key, normDocs), normDocs);
}

export function renderDocsHtml(
  registry: Registry,
  serverUrl: string,
  pathUrl = "/docs",
  rpcEndpoint = "/rpc",
  docsEndpoint = "/docs",
): string {
  const normDocsEndpoint = normalizeDocsEndpoint(docsEndpoint);
  const cleanPath = pathUrl.split("?")[0].replace(/\/+$/, "");

  let relativeSubPath = "";
  if (cleanPath === normDocsEndpoint) {
    relativeSubPath = "";
  } else if (cleanPath.startsWith(normDocsEndpoint + "/")) {
    relativeSubPath = cleanPath.slice(normDocsEndpoint.length + 1);
  } else {
    relativeSubPath = cleanPath.replace(/^\/+/, "");
  }

  const parts = relativeSubPath.split("/").filter(Boolean);

  if (parts.length === 2 && parts[0] === "middlewares") {
    const mwName = parts[1];
    const mw = registry.middlewares.get(mwName);
    if (mw) {
      return renderMiddlewareDoc(registry, mw, normDocsEndpoint);
    }
  }

  if (parts.length >= 2) {
    const nsParts = parts.slice(0, parts.length - 1);
    const fnName = parts[parts.length - 1];
    const ns = nsParts.join(".");
    const targetKey = `${ns}.${fnName}`;

    const fn = registry.functions.get(targetKey);
    if (fn) {
      return renderFunctionDoc(registry, fn, serverUrl, rpcEndpoint, normDocsEndpoint);
    }
  }

  return renderDocsIndex(registry, serverUrl, rpcEndpoint, normDocsEndpoint);
}
