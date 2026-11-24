// 사장님 화면 API. 모든 요청에 x-owner-pin 헤더가 필요합니다 (환경변수 OWNER_PIN, 없으면 0000).
// GET  /api/owner?action=feed
// POST /api/owner?action=reply    { ticketId, text }
// POST /api/owner?action=resolve  { ticketId }
// POST /api/owner?action=card     { room, lastName, checkout }
// POST /api/owner?action=checkout { token }
// POST /api/owner?action=memo
// POST /api/owner?action=reset    (시연 데이터 초기화)
import { readBody, send, query, uid } from "../lib/http.js";
import { ensureSeed, createCard, checkoutCard, isActive } from "../lib/cards.js";
import { translateOwnerReply, handoverMemo, aiMode } from "../lib/ai.js";
import * as store from "../lib/store.js";

const PIN = process.env.OWNER_PIN || "0000";

export default async function handler(req, res) {
  if ((req.headers["x-owner-pin"] || "") !== PIN) return send(res, 401, { ok: false, error: "pin" });
  const { action } = query(req);
  const body = req.method === "POST" ? await readBody(req) : {};

  if (action === "feed") {
    const [tickets, logs, events, cards, aiError] = await Promise.all([store.get("tickets", []), store.get("logs", []), store.get("events", []), ensureSeed(), store.get("aiError", null)]);
    const since = Date.now() - 24 * 3600 * 1000;
    const recentLogs = logs.filter((l) => l.ts > since);
    return send(res, 200, {
      ok: true, aiMode, storage: store.hasRedis ? "redis" : "memory", pinIsDefault: !process.env.OWNER_PIN, aiError: aiError && Date.now() - aiError.ts < 3600e3 ? aiError.msg : null,
      tickets: tickets.slice().reverse(),
      autoSolved: recentLogs.filter((l) => !l.escalate).length,
      questions: recentLogs.length,
      logs: recentLogs.slice(-30).reverse(),
      events: events.filter((e) => e.ts > since).slice(-10).reverse(),
      cards: Object.values(cards).sort((a, b) => b.createdAt - a.createdAt).map((c) => ({ ...c, active: isActive(c) })),
    });
  }

  if (action === "reply") {
    const text = String(body.text || "").trim().slice(0, 500);
    if (!text) return send(res, 400, { ok: false, error: "empty" });
    const tickets = await store.get("tickets", []);
    const tk = tickets.find((x) => x.id === body.ticketId);
    if (!tk) return send(res, 404, { ok: false });
    const translated = await translateOwnerReply({ room: tk.room, lang: tk.lang, ownerText: text });
    const now = Date.now();
    tk.replies.push({ textKo: text, translated, ts: now });
    await store.set("tickets", tickets);
    await store.push(`thread:${tk.token}`, { id: uid(), from: "owner", text: translated, textKo: text, ticketId: tk.id, ts: now }, 60);
    return send(res, 200, { ok: true, translated, lang: tk.lang });
  }

  if (action === "resolve") {
    const tickets = await store.get("tickets", []);
    const tk = tickets.find((x) => x.id === body.ticketId);
    if (tk) tk.status = "resolved";
    await store.set("tickets", tickets);
    return send(res, 200, { ok: true });
  }

  if (action === "card") {
    const { room, lastName, checkout } = body;
    if (!/^\d{2,4}$/.test(String(room || "")) || !String(lastName || "").trim() || isNaN(new Date(checkout)))
      return send(res, 400, { ok: false, error: "invalid" });
    const card = await createCard({ room, lastName, checkout });
    return send(res, 200, { ok: true, card });
  }

  if (action === "checkout") {
    await checkoutCard(body.token);
    return send(res, 200, { ok: true });
  }

  if (action === "memo") {
    const logs = (await store.get("logs", [])).filter((l) => l.ts > Date.now() - 12 * 3600 * 1000);
    const tickets = await store.get("tickets", []);
    const openSummaries = new Set(tickets.filter((t) => t.status === "open").map((t) => t.summaryKo));
    const enriched = logs.map((l) => ({ ...l, resolved: !l.escalate || !openSummaries.has(l.owner_summary_ko) }));
    const memo = await handoverMemo(enriched);
    return send(res, 200, { ok: true, memo });
  }

  if (action === "reset") {
    const cards = await ensureSeed();
    for (const k of Object.keys(cards)) { await store.set(`thread:${k}`, []); await store.set(`pending:${k}`, null); await store.set(`tries:${k}`, []); }
    await Promise.all(["tickets", "logs", "events"].map((k) => store.set(k, [])));
    await store.set("cards", null);
    await ensureSeed();
    return send(res, 200, { ok: true });
  }

  send(res, 400, { ok: false, error: "unknown_action" });
}
