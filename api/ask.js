// POST /api/ask { t, lang, message, image? } → AI 답변(JSON). 긴급 상황이면 사장님 알림을 바로 만듭니다.
import { readBody, send, uid, normLang, kstTime } from "../lib/http.js";
import { getCard, isActive } from "../lib/cards.js";
import { askGuestHost } from "../lib/ai.js";
import { createTicket } from "../lib/tickets.js";
import * as store from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false });
  const { t, lang: l, message = "", image } = await readBody(req);
  const card = await getCard(t);
  if (!card) return send(res, 404, { ok: false, error: "not_found" });
  if (!isActive(card)) return send(res, 403, { ok: false, error: "expired" });
  const lang = normLang(l);
  const text = String(message).slice(0, 800);
  if (!text && !image) return send(res, 400, { ok: false, error: "empty" });
  if (image && (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 3_000_000))
    return send(res, 400, { ok: false, error: "bad_image" });

  const thread = await store.get(`thread:${t}`, []);
  const history = thread
    .filter((m) => m.from === "guest" || m.from === "ai")
    .slice(-6)
    .map((m) => ({ role: m.from === "guest" ? "user" : "assistant", content: m.from === "ai" ? [m.text, ...(m.steps || [])].join("\n") : m.text }));

  const out = await askGuestHost({ room: card.room, lang, history, message: text, imageDataUrl: image });

  if (out.degraded) await store.set("aiError", { msg: out.degraded, ts: Date.now() });
  const now = Date.now();
  const guestMsg = { id: uid(), from: "guest", text: text || "(photo)", photo: !!image, ts: now };
  const aiMsg = { id: uid(), from: "ai", text: out.answer, steps: out.steps, sources: out.sources, ask_if_solved: out.ask_if_solved, escalate: out.escalate, urgency: out.urgency, ts: now + 1 };
  await store.set(`thread:${t}`, [...thread, guestMsg, aiMsg].slice(-60));
  await store.push("logs", { time: kstTime(now), ts: now, room: card.room, lang, intent: out.intent, escalate: out.escalate, urgency: out.urgency, owner_summary_ko: out.owner_summary_ko, grounded: out.grounded, resolved: !out.escalate, sources: out.sources });

  let ticket = null;
  if (out.escalate) {
    // 사장님 호출 대기: 손님이 본인 확인을 마치면 이 요약이 사장님에게 갑니다.
    await store.set(`pending:${t}`, { summaryKo: out.owner_summary_ko, original: text || "(사진 문의)", urgency: out.urgency, lang, ts: now });
    // 긴급 상황은 본인 확인 없이 바로 알림
    if (out.urgency === "emergency") ticket = await createTicket({ card, lang, summaryKo: out.owner_summary_ko, original: text, urgency: "emergency" });
  }
  send(res, 200, { ok: true, ...out, ticketId: ticket?.id || null });
}
