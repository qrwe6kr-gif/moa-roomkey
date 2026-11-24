// POST /api/escalate { t, lastName, topic?, original? } → 본인 확인 후 사장님에게 한국어 요약 알림
// topic: hot | temp | wifi | door | call | ai(직전 AI 대화에서 넘긴 요약 사용)
import { readBody, send, normLang } from "../lib/http.js";
import { getCard, isActive } from "../lib/cards.js";
import { createTicket, PRESETS, PRESET_URGENCY } from "../lib/tickets.js";
import * as store from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false });
  const { t, lastName = "", topic = "call", lang: l, original = "" } = await readBody(req);
  const card = await getCard(t);
  if (!card) return send(res, 404, { ok: false, error: "not_found" });
  if (!isActive(card)) return send(res, 403, { ok: false, error: "expired" });

  // 본인 확인: 예약자 성(대소문자·공백 무시). 10분에 5번까지만 시도 가능
  const triesKey = `tries:${t}`;
  const tries = (await store.get(triesKey, [])).filter((ts) => Date.now() - ts < 600000);
  if (tries.length >= 5) return send(res, 429, { ok: false, error: "too_many" });
  const norm = (s) => String(s).replace(/\s+/g, "").toUpperCase();
  if (norm(lastName) !== norm(card.lastName)) {
    await store.set(triesKey, [...tries, Date.now()]);
    return send(res, 401, { ok: false, error: "name_mismatch" });
  }

  const lang = normLang(l);
  let summaryKo, urgency, orig = String(original).slice(0, 300);
  if (topic === "ai") {
    const p = await store.get(`pending:${t}`, null);
    summaryKo = p?.summaryKo || PRESETS.call(card.room);
    urgency = p?.urgency && p.urgency !== "none" ? p.urgency : "normal";
    orig = p?.original || orig;
    await store.set(`pending:${t}`, null);
  } else {
    const f = PRESETS[topic] || PRESETS.call;
    summaryKo = f(card.room);
    urgency = PRESET_URGENCY[topic] || "normal";
  }
  const ticket = await createTicket({ card, lang, summaryKo, original: orig || "(문제 해결 화면에서 호출)", urgency });
  send(res, 200, { ok: true, ticketId: ticket.id, summaryKo, time: ticket.time });
}
