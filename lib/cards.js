// 카드키(=NFC에 쓰는 주소의 토큰) 관리. 카드에는 객실 번호나 이름이 들어가지 않고 무작위 토큰만 들어갑니다.
import * as store from "./store.js";
import { uid } from "./http.js";
import pack from "./promptpack.js";

const GRACE_MS = 7 * 3600 * 1000; // 체크아웃 후 7시간(짐 보관 18:00까지)까지 열림

// 시연용 카드: 처음 실행할 때 자동으로 만들어집니다.
function nextCheckout(daysAhead = 2) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + daysAhead, 11 - 9, 0, 0));
  return d.toISOString();
}

export async function ensureSeed() {
  const cards = await store.get("cards", null);
  if (cards) return cards;
  const seed = {
    demo203: { token: "demo203", room: "203", lastName: "TANAKA", checkout: nextCheckout(2), status: "active", createdAt: Date.now() },
    demo105: { token: "demo105", room: "105", lastName: "NGUYEN", checkout: new Date(Date.now() - 2 * 86400000).toISOString(), status: "checkedout", createdAt: Date.now() },
  };
  await store.set("cards", seed);
  return seed;
}

export async function getCard(token) {
  const cards = await ensureSeed();
  return cards[token] || null;
}

export function isActive(card) {
  if (!card || card.status !== "active") return false;
  return Date.now() < new Date(card.checkout).getTime() + GRACE_MS;
}

export async function createCard({ room, lastName, checkout }) {
  const token = uid(12);
  const card = { token, room: String(room), lastName: String(lastName).trim().toUpperCase(), checkout: new Date(checkout).toISOString(), status: "active", createdAt: Date.now() };
  await store.update("cards", (c) => ({ ...(c || {}), [token]: card }), {});
  return card;
}

export async function checkoutCard(token) {
  return store.update("cards", (c) => { if (c?.[token]) c[token].status = "checkedout"; return c; }, {});
}

// 손님 화면에 보여 줄 정보만 골라서 반환 (이름은 절대 보내지 않음)
export function publicStay(card) {
  const m = pack.manual.meta;
  return {
    name_en: m.name_en, name_ko: m.name_ko,
    room: card.room,
    wifi_ssid: `MOA_${card.room}`,
    wifi_pass: "moa2026",
    checkout: card.checkout,
    late_fee: "₩10,000",
  };
}
