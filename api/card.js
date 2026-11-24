// GET /api/card?t=토큰 → 카드가 유효하면 손님 화면에 필요한 숙소 정보, 만료됐으면 expired만
import { send, query, kstTime } from "../lib/http.js";
import { getCard, isActive, publicStay } from "../lib/cards.js";
import { aiMode } from "../lib/ai.js";
import * as store from "../lib/store.js";

export default async function handler(req, res) {
  const { t } = query(req);
  const card = t ? await getCard(t) : null;
  if (!card) return send(res, 404, { ok: false, error: "not_found" });
  if (!isActive(card)) {
    await store.push("events", { type: "expired_access", room: card.room, ts: Date.now(), time: kstTime() }, 100);
    return send(res, 200, { ok: true, expired: true });
  }
  send(res, 200, { ok: true, expired: false, stay: publicStay(card), aiMode });
}
