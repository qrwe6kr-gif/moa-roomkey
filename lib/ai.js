// AI 호출. ANTHROPIC_API_KEY가 있으면 Claude, 없고 OPENAI_API_KEY가 있으면 OpenAI를 씁니다.
// 둘 다 없거나 호출이 실패하면 데모 답변(lib/demo.js)으로 자동 전환합니다.
import pack from "./promptpack.js";
import { demoAnswer, demoTranslate, demoMemo } from "./demo.js";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean);
const CLAUDE_KEY = GEMINI_KEY ? null : process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
const KEY = GEMINI_KEY || CLAUDE_KEY ? null : process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
export const aiMode = GEMINI_KEY ? "gemini" : CLAUDE_KEY ? "claude" : KEY ? "openai" : "demo";

// ---- Gemini (Google AI Studio 무료 키) ----
// 구조화 출력 요청 형식이 API 버전마다 달라서, 거절(400)되면 다음 형식으로 다시 시도합니다.
const geminiWorking = { json: null, text: null }; // 성공한 { model, fmt } 조합을 기억
async function gemini({ system, contents, schema, maxTokens = 4096 }) {
  const fmts = schema
    ? [
        (s) => ({ responseFormat: { text: { mimeType: "application/json", schema: s } } }),
        (s) => ({ responseMimeType: "application/json", responseJsonSchema: s }),
        () => ({ responseMimeType: "application/json" }),
      ]
    : [() => ({})];
  const kind = schema ? "json" : "text";
  const models = geminiWorking.json || geminiWorking.text ? [...new Set([(geminiWorking[kind] || geminiWorking.json || geminiWorking.text).model, ...GEMINI_MODELS])] : GEMINI_MODELS;
  const combos = geminiWorking[kind] ? [geminiWorking[kind]] : models.flatMap((model) => fmts.map((_, fmt) => ({ model, fmt })));
  let lastErr;
  for (const c of combos) {
    const body = {
      systemInstruction: { parts: [{ text: schema && c.fmt === 2 ? system + "\n\nReturn ONLY a JSON object matching this JSON Schema:\n" + JSON.stringify(schema) : system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, ...fmts[c.fmt](schema) },
    };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) {
      const d = await r.json();
      const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      if (!text) { lastErr = new Error("Gemini empty response " + (d.candidates?.[0]?.finishReason || "")); continue; }
      geminiWorking[kind] = c;
      return text;
    }
    const t = (await r.text()).slice(0, 200);
    lastErr = new Error(`Gemini ${c.model} HTTP ${r.status}: ${t}`);
    if (r.status === 429 || r.status === 401 || r.status === 403) break; // 한도 초과·키 문제는 다른 조합으로도 안 됨
    if (geminiWorking[kind]) geminiWorking[kind] = null;
  }
  throw lastErr;
}
function toGeminiContents(history, parts) {
  const out = [];
  for (const h of history) {
    const role = h.role === "assistant" ? "model" : "user";
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n" + h.content;
    else out.push({ role, parts: [{ text: h.content }] });
  }
  if (out[0]?.role === "model") out.shift();
  if (out[out.length - 1]?.role === "user") parts.unshift(...out.pop().parts);
  return [...out, { role: "user", parts }];
}
function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}
// 빠진 필드를 기본값으로 채움
function completeGuest(o, room, lang) {
  const d = { language: lang, intent: "other", answer: "", steps: [], ask_if_solved: false, grounded: false, sources: [], escalate: false, urgency: "none", owner_summary_ko: "" };
  const out = { ...d, ...o };
  for (const k of ["steps", "sources"]) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ["ask_if_solved", "grounded", "escalate"]) out[k] = out[k] === true || out[k] === "true";
  out.steps = out.steps.map(String).slice(0, 6);
  if (out.escalate && !out.owner_summary_ko) out.owner_summary_ko = `${room}호 손님 문의: 확인 필요`;
  return out;
}

// ---- Claude (Messages API, 구조화 출력: output_config.format) ----
async function claude({ system, messages, schema, maxTokens = 1024 }) {
  const body = { model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages };
  if (schema) body.output_config = { format: { type: "json_schema", schema } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Claude HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const msg = await r.json();
  if (msg.stop_reason === "refusal") throw new Error("Claude refused");
  if (msg.stop_reason === "max_tokens") throw new Error("Claude output truncated");
  return (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
// 대화 기록을 Claude 형식으로 (user/assistant가 번갈아 나와야 함)
function toClaudeMessages(history, userContent) {
  const out = [];
  for (const h of history) {
    const last = out[out.length - 1];
    if (last && last.role === h.role) last.content += "\n" + h.content;
    else out.push({ role: h.role, content: h.content });
  }
  if (out[0]?.role === "assistant") out.shift();
  if (out[out.length - 1]?.role === "user") { const u = out.pop(); userContent.unshift({ type: "text", text: u.content }); }
  return [...out, { role: "user", content: userContent }];
}
const ENUMS = { language: ["en", "ja", "zh", "ko", "vi", "th"], intent: ["facility", "rules_fees", "info", "emergency", "complaint", "other"], urgency: ["none", "normal", "urgent", "emergency"] };
function normEnums(o) { // 열거값 대소문자 보정
  for (const [k, vals] of Object.entries(ENUMS)) { const v = String(o[k] || "").toLowerCase(); o[k] = vals.includes(v) ? v : vals[vals.length - 1]; }
  if (!ENUMS.language.includes(o.language)) o.language = "en";
  return o;
}

let client = null;
async function getClient() {
  if (!KEY) return null;
  if (!client) {
    const { default: OpenAI } = await import("openai");
    client = new OpenAI({ apiKey: KEY });
  }
  return client;
}

const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const manualJson = JSON.stringify(pack.manual);
const nowSeoul = () => new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });

function safeFallback(room, lang) {
  return {
    language: lang, intent: "other", answer: "", steps: [], ask_if_solved: false, grounded: false, sources: [],
    escalate: true, urgency: "normal", owner_summary_ko: `${room}호 손님 문의: AI 응답 오류. 확인 필요`,
  };
}

export async function askGuestHost({ room, lang, history = [], message, imageDataUrl }) {
  if (GEMINI_KEY) {
    try {
      const parts = [];
      if (imageDataUrl) {
        const m = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      }
      parts.push({ text: message || "(photo)" });
      const text = await gemini({
        system: fill(pack.guest, { STAY_MANUAL_JSON: manualJson, ROOM: room, GUEST_LANG: lang, NOW_LOCAL: nowSeoul() }),
        contents: toGeminiContents(history, parts),
        schema: pack.schema,
      });
      let out;
      try { out = normEnums(completeGuest(parseJsonLoose(text), room, lang)); } catch { out = safeFallback(room, lang); }
      if (out.urgency === "emergency") out.escalate = true;
      if (!out.escalate) out.owner_summary_ko = "";
      return { ...out, mode: "gemini" };
    } catch (e) {
      console.error("[gemini] ask failed:", e?.message);
      return { ...demoAnswer({ room, lang, message, hasImage: !!imageDataUrl }), mode: "demo", degraded: String(e?.message || e) };
    }
  }
  if (CLAUDE_KEY) {
    try {
      const content = [];
      if (imageDataUrl) {
        const m = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      }
      content.push({ type: "text", text: message || "(photo)" });
      const text = await claude({
        system: fill(pack.guest, { STAY_MANUAL_JSON: manualJson, ROOM: room, GUEST_LANG: lang, NOW_LOCAL: nowSeoul() }),
        messages: toClaudeMessages(history, content),
        schema: pack.schema,
      });
      let out;
      try { out = normEnums(JSON.parse(text)); } catch { out = safeFallback(room, lang); }
      if (out.urgency === "emergency") out.escalate = true;
      if (!out.escalate) out.owner_summary_ko = "";
      return { ...out, mode: "claude" };
    } catch (e) {
      console.error("[claude] ask failed:", e?.message);
      return { ...demoAnswer({ room, lang, message, hasImage: !!imageDataUrl }), mode: "demo", degraded: String(e?.message || e) };
    }
  }
  const c = await getClient();
  if (!c) return { ...demoAnswer({ room, lang, message, hasImage: !!imageDataUrl }), mode: "demo" };

  const userContent = [{ type: "input_text", text: message || "(photo)" }];
  if (imageDataUrl) userContent.push({ type: "input_image", image_url: imageDataUrl });
  try {
    const res = await c.responses.create({
      model: MODEL,
      instructions: fill(pack.guest, { STAY_MANUAL_JSON: manualJson, ROOM: room, GUEST_LANG: lang, NOW_LOCAL: nowSeoul() }),
      input: [...history, { role: "user", content: userContent }],
      text: { format: { type: "json_schema", name: "guest_response", strict: true, schema: pack.schema } },
    });
    let out;
    try { out = JSON.parse(res.output_text); } catch { out = safeFallback(room, lang); }
    if (out.urgency === "emergency") out.escalate = true;
    if (!out.escalate) out.owner_summary_ko = "";
    return { ...out, mode: "openai" };
  } catch (e) {
    console.error("[openai] ask failed:", e?.status, e?.message);
    return { ...demoAnswer({ room, lang, message, hasImage: !!imageDataUrl }), mode: "demo", degraded: String(e?.message || e) };
  }
}

export async function translateOwnerReply({ room, lang, ownerText }) {
  if (lang === "ko") return ownerText;
  if (GEMINI_KEY) {
    try { return await gemini({ system: fill(pack.reply, { ROOM: room, GUEST_LANG: lang }), contents: [{ role: "user", parts: [{ text: ownerText }] }], maxTokens: 2048 }); }
    catch (e) { console.error("[gemini] translate failed:", e?.message); return demoTranslate(ownerText, lang); }
  }
  if (CLAUDE_KEY) {
    try { return await claude({ system: fill(pack.reply, { ROOM: room, GUEST_LANG: lang }), messages: [{ role: "user", content: ownerText }], maxTokens: 500 }); }
    catch (e) { console.error("[claude] translate failed:", e?.message); return demoTranslate(ownerText, lang); }
  }
  const c = await getClient();
  if (!c) return demoTranslate(ownerText, lang);
  try {
    const res = await c.responses.create({ model: MODEL, instructions: fill(pack.reply, { ROOM: room, GUEST_LANG: lang }), input: ownerText });
    return res.output_text.trim();
  } catch (e) {
    console.error("[openai] translate failed:", e?.message);
    return demoTranslate(ownerText, lang);
  }
}

export async function handoverMemo(logs) {
  if (GEMINI_KEY) {
    try { return await gemini({ system: pack.memo, contents: [{ role: "user", parts: [{ text: JSON.stringify(logs) }] }], maxTokens: 4096 }); }
    catch (e) { console.error("[gemini] memo failed:", e?.message); return demoMemo(logs); }
  }
  if (CLAUDE_KEY) {
    try { return await claude({ system: pack.memo, messages: [{ role: "user", content: JSON.stringify(logs) }], maxTokens: 800 }); }
    catch (e) { console.error("[claude] memo failed:", e?.message); return demoMemo(logs); }
  }
  const c = await getClient();
  if (!c) return demoMemo(logs);
  try {
    const res = await c.responses.create({ model: MODEL, instructions: pack.memo, input: JSON.stringify(logs) });
    return res.output_text.trim();
  } catch (e) {
    console.error("[openai] memo failed:", e?.message);
    return demoMemo(logs);
  }
}
