// OpenAI 호출. OPENAI_API_KEY가 없거나 호출이 실패하면 데모 답변(lib/demo.js)으로 자동 전환합니다.
import pack from "./promptpack.js";
import { demoAnswer, demoTranslate, demoMemo } from "./demo.js";

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
export const aiMode = KEY ? "openai" : "demo";

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
