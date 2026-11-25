// POST /api/message { t, lastName, text, lang } → 본인 확인 후 손님 문의를 한국어로 번역해 사장님에게 알림
import { readBody, send, uid, normLang } from "../lib/http.js";
import { getCard, isActive } from "../lib/cards.js";
import { createTicket } from "../lib/tickets.js";
import { translateToKorean } from "../lib/ai.js";
import * as store from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false });
  const { t, lastName = "", text: raw = "", lang: l } = await readBody(req);
  const card = await getCard(t);
  if (!card) return send(res, 404, { ok: false, error: "not_found" });
  if (!isActive(card)) return send(res, 403, { ok: false, error: "expired" });
  const text = String(raw).trim().slice(0, 500);
  if (!text) return send(res, 400, { ok: false, error: "empty" });

  const triesKey = `tries:${t}`;
  const tries = (await store.get(triesKey, [])).filter((ts) => Date.now() - ts < 600000);
  if (tries.length >= 5) return send(res, 429, { ok: false, error: "too_many" });
  const norm = (s) => String(s).replace(/\s+/g, "").toUpperCase();
  if (norm(lastName) !== norm(card.lastName)) {
    await store.set(triesKey, [...tries, Date.now()]);
    return send(res, 401, { ok: false, error: "name_mismatch" });
  }

  const lang = normLang(l);
  const ko = await translateToKorean(text, lang);
  const summaryKo = `${card.room}호 손님 문의: ${ko || "(번역 실패 · 아래 원문 확인)"}`;
  await store.push(`thread:${t}`, { id: uid(), from: "guest", via: "help", text, ts: Date.now() }, 60);
  const ticket = await createTicket({ card, lang, summaryKo, original: text, urgency: "normal" });
  send(res, 200, { ok: true, ticketId: ticket.id });
}
