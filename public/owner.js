// 모아스테이 사장님 화면 (Figma 06) — 알림 확인, 한국어 답장(자동 번역), 카드 발급, 아침 인계 메모
import { icon } from "./icons.js";

const $app = document.getElementById("app");
let PIN = sessionStorage.getItem("moa:pin") || "";
let feed = null, memo = "", openReply = null, lastSent = {}, newCard = null, seenTickets = null;
const LANG_KO = { en: "영어", ja: "일본어", zh: "중국어", ko: "한국어", vi: "베트남어", th: "태국어" };
const SRC_KO = { checkin: "체크인", cardkey_power: "카드키·전기", door_lock: "도어락", hot_water_heating: "보일러", aircon: "에어컨", tv: "TV", wifi: "와이파이", amenities: "비품", lobby: "로비", laundry: "세탁", trash: "분리수거", rules: "규칙", checkout_fees: "체크아웃·요금", luggage: "짐 보관", cancellation: "취소·환불", parking: "주차", nearby: "주변 가게", emergency: "긴급", owner_contact: "사장님 연결" };
const QUICK = ["지금 올라갈게요. 5분만 기다려 주세요.", "확인해 보고 10분 안에 다시 연락드릴게요.", "내일 아침 8시에 프런트에서 도와드릴게요."];
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(action, body) {
  const r = await fetch(`/api/owner?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-owner-pin": PIN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { PIN = ""; sessionStorage.removeItem("moa:pin"); pinScreen("PIN이 맞지 않아요."); throw new Error("pin"); }
  if (!r.ok) throw new Error(d.error || r.status);
  return d;
}

function pinScreen(msg = "") {
  $app.innerHTML = `<section class="screen"><div class="full-center center pin">
    <div class="big-lock">${icon("lock")}</div><h2>모아스테이 사장님 화면</h2><p>PIN을 입력하세요</p>
    <form id="pf"><input id="pin" inputmode="numeric" type="password" autocomplete="current-password" maxlength="12" autofocus>
    ${msg ? `<div class="err" style="text-align:center">${msg}</div>` : ""}
    <button class="btn btn-primary">들어가기</button></form></div></section>`;
  $app.querySelector("#pf").onsubmit = (e) => { e.preventDefault(); PIN = $app.querySelector("#pin").value.trim(); sessionStorage.setItem("moa:pin", PIN); load(); };
}

const titleOf = (s = "") => s.split(":")[0];
const bodyOf = (s = "") => s.split(":").slice(1).join(":").trim();

function ticketHtml(tk) {
  const resolved = tk.status === "resolved";
  const last = tk.replies?.[tk.replies.length - 1];
  return `<div class="tk ${resolved ? "resolved" : tk.urgency === "emergency" ? "emergency" : ""}" data-id="${tk.id}">
    <div class="h">${icon(tk.urgency === "emergency" ? "emergency" : "bell")}<b>${esc(titleOf(tk.summaryKo))}</b><span class="tm">${esc(tk.time)}</span></div>
    ${bodyOf(tk.summaryKo) ? `<div class="body">${esc(bodyOf(tk.summaryKo))}</div>` : ""}
    <div class="orig">손님 원문(${LANG_KO[tk.lang] || tk.lang}): ${esc(tk.original)}</div>
    ${last ? `<div class="sent">보낸 답장: ${esc(last.textKo)}<br>→ 손님 화면: ${esc(last.translated)}</div>` : ""}
    ${resolved ? "" : `<div class="acts"><button class="btn btn-primary" data-reply="${tk.id}">손님에게 답장</button><button class="btn btn-outline" data-resolve="${tk.id}">해결됨</button></div>`}
    ${openReply === tk.id ? `<div class="composer-o"><small>한국어로 답하면 손님 언어(${LANG_KO[tk.lang] || tk.lang})로 번역돼 전달됩니다</small>
      <form class="composer" data-form="${tk.id}"><input placeholder="예: 지금 올라갈게요." autocomplete="off" value="${esc(lastSent[tk.id + ":draft"] || "")}"><button class="send" aria-label="보내기">${icon("send")}</button></form>
      <div class="quick">${QUICK.map((q) => `<button type="button" data-quick="${tk.id}">${q}</button>`).join("")}</div></div>` : ""}
  </div>`;
}

function logHtml(l) {
  const what = (l.sources || []).map((s) => SRC_KO[s] || s).join("·") || "일반";
  return `<div class="card log">${icon(l.escalate ? "bell" : "rules")}<div><b>${esc(l.room)}호 ${esc(what)} ${l.escalate ? "문의" : "확인"}</b>
    <span>${l.escalate ? esc(l.owner_summary_ko || "사장님 확인 필요") : `AI가 매뉴얼로 답했어요 (${LANG_KO[l.lang] || l.lang})`}</span></div><span class="tm">${esc(l.time)}</span></div>`;
}

function render() {
  const f = feed;
  const open = f.tickets.filter((x) => x.status === "open");
  const done = f.tickets.filter((x) => x.status !== "open").slice(0, 5);
  const ev = f.events.map((e) => `<div class="card log">${icon("lock")}<div><b>만료 카드 접근 시도</b><span>체크아웃한 ${esc(e.room)}호 카드로 접속 시도. 개인정보는 표시되지 않았습니다.</span></div><span class="tm">${esc(e.time)}</span></div>`).join("");
  const base = location.origin;
  $app.innerHTML = `<section class="screen"><div class="scroll">
    <div class="o-head"><div class="who">모아스테이 · 사장님</div><h1>오늘 알림 ${open.length + f.events.length}건</h1>
      <div class="o-chips"><span class="o-chip warn">확인 필요 ${open.length}</span><span class="o-chip ok">AI 자동 해결 ${f.autoSolved}</span></div></div>
    <div class="o-body">
      ${open.map(ticketHtml).join("") || `<div class="card log">${icon("check")}<div><b>확인할 알림이 없어요</b><span>손님 문의는 AI가 매뉴얼로 답하고 있어요.</span></div></div>`}
      ${f.logs.length ? `<div class="o-label">AI가 처리한 문의</div>${f.logs.filter((l) => !l.escalate).slice(0, 6).map(logHtml).join("")}` : ""}
      ${ev}
      <div class="memo"><b>아침 인계 메모</b>${memo ? `<pre>${esc(memo)}</pre>` : `<pre>밤사이 문의 ${f.questions}건 · AI 자동 해결 ${f.autoSolved}건 · 확인 필요 ${open.length}건</pre>`}
        <button class="btn" id="memoBtn">${memo ? "다시 만들기" : "AI로 인계 메모 만들기"}</button></div>
      ${done.length ? `<div class="o-label">해결된 알림</div>${done.map(ticketHtml).join("")}` : ""}

      <div class="o-label">카드키 (NFC)</div>
      ${f.cards.map((c) => `<div class="card cardrow">${icon("lock")}<div class="grow"><b>${esc(c.room)}호 카드</b>
        <small>${c.active ? new Date(c.checkout).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " 체크아웃 · 유효" : "만료됨"}</small>
        ${c.active ? `<div class="url">${esc(base)}/k/${esc(c.token)}</div>` : ""}</div>
        ${c.active ? `<div class="cbtns"><button class="sbtn" data-copy="${esc(base)}/k/${esc(c.token)}">주소 복사</button><button class="sbtn" data-checkout="${esc(c.token)}">체크아웃 처리</button></div>` : ""}</div>`).join("")}
      <form class="card form" id="cardForm"><b>새 카드 발급 (체크인)</b>
        <div class="two"><label>객실 번호<input name="room" inputmode="numeric" placeholder="203" required></label>
        <label>예약자 성 (영문)<input name="lastName" placeholder="TANAKA" required></label></div>
        <label>체크아웃<input name="checkout" type="datetime-local" required value="${defaultCheckout()}"></label>
        <button class="btn btn-primary">카드 주소 만들기</button>
        ${newCard ? `<div class="newcard"><b>${esc(newCard.room)}호 카드 주소</b><div class="url">${esc(base)}/k/${esc(newCard.token)}</div>
          NFC Tools 앱 → 쓰기 → 레코드 추가 → URL → 위 주소 붙여넣기 → 카드키에 대기. 체크아웃 7시간 뒤 자동으로 만료돼요.</div>` : ""}
      </form>

      <div class="sys-foot">AI: ${f.aiMode === "openai" ? "OpenAI 연결됨" : `<span class="warn">데모 모드 (OPENAI_API_KEY 없음)</span>`} ·
        저장소: ${f.storage === "redis" ? "Redis 연결됨" : `<span class="warn">메모리 (로컬 테스트용 · Vercel에선 Redis 연결 필요)</span>`}
        ${f.aiError ? ` · <span class="warn">최근 OpenAI 호출 실패 → 데모 답변으로 대체됨 (${esc(f.aiError)}). API 키·OPENAI_MODEL을 확인하세요</span>` : ""}
        ${f.pinIsDefault ? ` · <span class="warn">PIN이 기본값(0000)이에요. OWNER_PIN 환경변수를 설정하세요</span>` : ""}<br>
        <button class="sbtn" id="reset" style="margin-top:8px">시연 데이터 초기화</button> · 손님 데모: <a href="/k/demo203" target="_blank" style="text-decoration:underline">/k/demo203</a></div>
    </div></div></section>`;
  bind();
}

function defaultCheckout() {
  const d = new Date(Date.now() + 9 * 3600e3 + 86400e3);
  return d.toISOString().slice(0, 10) + "T11:00";
}

function bind() {
  $app.querySelectorAll("[data-reply]").forEach((b) => (b.onclick = () => { openReply = openReply === b.dataset.reply ? null : b.dataset.reply; render(); $app.querySelector(`[data-form="${openReply}"] input`)?.focus(); }));
  $app.querySelectorAll("[data-resolve]").forEach((b) => (b.onclick = async () => { await api("resolve", { ticketId: b.dataset.resolve }); load(); }));
  $app.querySelectorAll("[data-quick]").forEach((b) => (b.onclick = () => { const i = $app.querySelector(`[data-form="${b.dataset.quick}"] input`); i.value = b.textContent; i.focus(); }));
  $app.querySelectorAll("[data-form]").forEach((form) => (form.onsubmit = async (e) => {
    e.preventDefault();
    const inp = form.querySelector("input"), text = inp.value.trim();
    if (!text) return;
    form.querySelector("button").disabled = true;
    try { await api("reply", { ticketId: form.dataset.form, text }); openReply = null; delete lastSent[form.dataset.form + ":draft"]; await load(); }
    catch { form.querySelector("button").disabled = false; alert("보내지 못했어요. 다시 시도해 주세요."); }
  }));
  $app.querySelectorAll("[data-form] input").forEach((i) => (i.oninput = () => (lastSent[i.closest("form").dataset.form + ":draft"] = i.value)));
  $app.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "복사됨"; } catch {} }));
  $app.querySelectorAll("[data-checkout]").forEach((b) => (b.onclick = async () => { if (confirm("체크아웃 처리하면 이 카드는 바로 만료돼요. 진행할까요?")) { await api("checkout", { token: b.dataset.checkout }); load(); } }));
  $app.querySelector("#memoBtn").onclick = async (e) => { e.target.disabled = true; e.target.textContent = "만드는 중…"; try { memo = (await api("memo", {})).memo; } finally { render(); } };
  $app.querySelector("#cardForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { newCard = (await api("card", { room: fd.room, lastName: fd.lastName, checkout: new Date(fd.checkout + ":00+09:00").toISOString() })).card; await load(); }
    catch { alert("입력값을 확인해 주세요. (객실 번호는 숫자 2~4자리)"); }
  };
  $app.querySelector("#reset").onclick = async () => { if (confirm("시연용 대화·알림·기록을 모두 지우고 처음 상태로 돌릴까요?")) { await api("reset", {}); memo = ""; newCard = null; seenTickets = null; load(); } };
}

function chime() {
  try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.15, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .4); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .4); } catch {}
}

async function load() {
  if (!PIN) return pinScreen();
  try { feed = await api("feed"); } catch { return; }
  const ids = new Set(feed.tickets.map((x) => x.id));
  if (seenTickets && [...ids].some((id) => !seenTickets.has(id))) { chime(); document.title = "🔔 새 알림 · 모아스테이"; }
  seenTickets = ids;
  render();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) document.title = "모아스테이 · 사장님"; });
setInterval(() => {
  const a = document.activeElement;
  if (!PIN || document.hidden || (a && /INPUT|TEXTAREA/.test(a.tagName))) return;
  load();
}, 5000);
load();
