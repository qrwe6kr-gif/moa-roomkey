// 사장님 알림(티켓)
import * as store from "./store.js";
import { uid, kstTime } from "./http.js";

export async function createTicket({ card, lang, summaryKo, original, urgency = "normal" }) {
  const now = Date.now();
  const ticket = { id: uid(), token: card.token, room: card.room, lang, summaryKo, original, urgency, status: "open", ts: now, time: kstTime(now), replies: [] };
  await store.push("tickets", ticket, 200);
  await store.push(`thread:${card.token}`, { id: uid(), from: "system", kind: "notified", ticketId: ticket.id, summaryKo, ts: now }, 60);
  return ticket;
}

// 문제 해결 화면에서 "아직 안 돼요"를 눌렀을 때 쓰는 고정 요약 (사장님 용어 사용)
export const PRESETS = {
  hot: (room) => `${room}호 보일러 온수 문제: 안내대로 '온수' 버튼 누르고 5분 기다렸는데도 온수가 안 나옴. 확인 필요`,
  temp: (room) => `${room}호 난방·냉방 문제: 바닥 난방·에어컨 안내대로 했는데도 방 온도가 안 맞음. 확인 필요`,
  wifi: (room) => `${room}호 와이파이 문제: MOA_${room} 연결·공유기 재시작 안내 후에도 연결 안 됨. 확인 필요`,
  door: (room) => `${room}호 카드키 문제: 도어락 인식 또는 객실 전기 안내 후에도 해결 안 됨. 즉시 확인 필요`,
  call: (room) => `${room}호 손님 직접 호출: 사장님 연결 요청. 확인 필요`,
};
export const PRESET_URGENCY = { hot: "urgent", temp: "urgent", wifi: "normal", door: "urgent", call: "normal" };
