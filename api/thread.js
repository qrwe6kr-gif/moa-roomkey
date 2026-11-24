// GET /api/thread?t=토큰&since=타임스탬프 → 새 메시지(사장님 답장 포함). 손님 화면이 몇 초마다 확인합니다.
import { send, query } from "../lib/http.js";
import { getCard, isActive } from "../lib/cards.js";
import * as store from "../lib/store.js";

export default async function handler(req, res) {
  const { t, since = "0" } = query(req);
  const card = await getCard(t);
  if (!card) return send(res, 404, { ok: false });
  if (!isActive(card)) return send(res, 200, { ok: true, expired: true, messages: [] });
  const thread = await store.get(`thread:${t}`, []);
  const s = Number(since) || 0;
  send(res, 200, { ok: true, messages: thread.filter((m) => m.ts > s) });
}
