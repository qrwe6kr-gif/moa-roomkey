// 모아스테이 룸키 — 손님 화면 (Figma 01~11 화면)
import { DICT, LANGS, KO_SUB, SPEECH, LANG_NAME_IN, SOURCE_NAME } from "./i18n.js";
import { icon } from "./icons.js";
import { GUIDE, GUIDE_UI, MSG_UI } from "./guide.js";

const $app = document.getElementById("app");
const token = (location.pathname.match(/^\/k\/([^/]+)/) || [])[1] || new URLSearchParams(location.search).get("t");
const NAV = ((navigator.language || "en").slice(0, 2) in DICT) ? navigator.language.slice(0, 2) : "en";
const LS = (k) => `moa:${k}:${token}`;
const S = {
  stay: null, aiMode: "demo",
  lang: localStorage.getItem(LS("lang")),
  thread: [], lastTs: 0, pending: null, typing: false, answered: new Set(),
  lastTicket: null, photo: null, offline: false,
  langDone: false, // 카드키를 탭해 열 때마다 언어 선택 화면부터 보여 줌
};

// ---------- 도우미 ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t = (k, vars = {}) => {
  const s = (DICT[S.lang || NAV] || DICT.en)[k] ?? DICT.en[k] ?? k;
  return s.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
};
const ko = (k) => (S.lang === "ko" || !KO_SUB[k] ? "" : `<span class="ko">${KO_SUB[k]}</span>`);
const toast = (msg) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); };
const go = (h) => { location.hash = h; };
const back = () => (history.length > 1 ? history.back() : go(""));

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || r.status); e.status = r.status; e.data = data; throw e; }
  return data;
}

function fmtCheckout(iso) {
  const d = new Date(iso);
  const loc = { en: "en-US", ja: "ja-JP", zh: "zh-CN", ko: "ko-KR", vi: "vi-VN", th: "th-TH" }[S.lang] || "en-US";
  const md = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(d);
  const wd = new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "Asia/Seoul" }).format(d);
  const hm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(d);
  return { full: `${md} (${wd}) · ${hm}`, short: `${md} · ${hm}` };
}

const tabbar = (on) => `
  <nav class="tabbar">
    <button class="tab ${on === "home" ? "on" : ""}" data-go="">${icon("home")}${t("home")}</button>
    <button class="tab ${on === "chat" ? "on" : ""}" data-go="chat">${icon("chat")}${t("askai")}</button>
    <button class="tab ${on === "help" ? "on" : ""}" data-go="help">${icon("help")}${t("help")}</button>
  </nav>`;
const topbar = (title, koKey, koRaw) => `
  <header class="topbar"><button class="back" data-back aria-label="Back">${icon("back")}</button>
  <div><h1>${esc(title)}</h1>${koRaw ? (S.lang === "ko" ? "" : `<span class="ko">${koRaw}</span>`) : ko(koKey)}</div></header>`;

// ---------- 화면 ----------
const V = {};

// 01 언어 선택
V.lang = () => {
  const nav = (navigator.language || "en").slice(0, 2);
  const detected = LANGS.find((l) => l.code === nav) || LANGS[0];
  let pick = S.lang || detected.code;
  const draw = () => {
    const prev = S.lang; S.lang = pick;
    $app.innerHTML = `
    <section class="screen"><div class="scroll lang-screen">
      <div class="welcome">${t("welcome")}</div>
      <div class="muted" style="font-size:14px">${t("choose")}</div>${S.lang === "ko" ? "" : `<div class="ko" style="font-size:14px">${KO_SUB.choose}</div>`}
      <div style="margin-top:14px"><span class="chip chip-teal">${icon("globe")}${t("detected", { lang: detected.sub })}</span></div>
      <div class="lang-list">${LANGS.map((l) => `
        <button class="lang-item ${l.code === pick ? "on" : ""}" data-lang="${l.code}"><span><b>${l.name}</b><small>${l.sub}</small></span>
        ${l.code === pick ? `<span class="check-dot">${icon("check")}</span>` : ""}</button>`).join("")}</div>
      <button class="btn btn-primary" id="cont">${t("continue")}</button>
      <div class="foot-note">${t("change_anytime")}</div>
    </div></section>`;
    S.lang = prev;
    $app.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => { pick = b.dataset.lang; draw(); }));
    $app.querySelector("#cont").onclick = () => { S.lang = pick; S.langDone = true; localStorage.setItem(LS("lang"), pick); document.documentElement.lang = pick; if (location.hash.slice(1) === "lang") go(""); else render(); };
  };
  draw();
};

// 02 홈 (Figma 02 Home: 체크아웃 카드만, 구분선 있는 3개 섹션)
V.home = () => {
  const s = S.stay, co = fmtCheckout(s.checkout);
  const sub = (k, size) => (S.lang === "ko" || !KO_SUB[k] ? "" : `<span class="ko" style="font-size:${size || 10}px">${KO_SUB[k]}</span>`);
  $app.innerHTML = `
  <section class="screen"><div class="scroll">
    <div class="home-head">
      <div class="head-row"><div><div class="room">ROOM ${esc(s.room)}</div><h1>${esc(s.name_en)}</h1></div>
        <button class="lang-pill" data-go="lang">${icon("globe")}${(S.lang || "en").toUpperCase()}</button></div>
      <div class="card info-card">
        <div class="lbl">${t("checkout")}${S.lang === "ko" ? "" : "&nbsp; " + KO_SUB.checkout}</div>
        <div class="val">${esc(co.full)}</div>
        <div class="sub">${t("late", { fee: s.late_fee })}</div>
      </div>
    </div>
    <div class="home-body">
      <section class="hsec">
        <h2 class="htitle">${t("not_working")} ${sub("not_working")}</h2>
        <div class="problems">
          ${[["hot", "hotLg", "p_hot"], ["temp", "thermo", "p_temp"], ["wifi", "wifi", "p_wifi"], ["door", "door", "p_door"]].map(([id, ic, k]) => `
            <button class="problem" data-go="fix-${id}"><span class="circle">${icon(ic)}</span><b>${t(k)}</b>${ko(k)}</button>`).join("")}
        </div>
      </section>
      <hr class="hdiv">
      <section class="hsec">
        <h2 class="htitle">${t("guide")} ${sub("guide")}</h2>
        <div class="tiles">
          ${[["air", "t_air"], ["trash", "t_trash"], ["rules", "t_rules"]].map(([ic, k]) => `
            <button class="card tile" data-go="guide-${ic}"><span class="icon-box">${icon(ic)}</span><span><b>${t(k)}</b>${ko(k)}</span></button>`).join("")}
          <button class="card tile" data-go="photo"><span class="icon-box">${icon("photo")}</span><span><b>${t("t_photo")}</b>${ko("t_photo")}</span></button>
        </div>
      </section>
      <hr class="hdiv">
      <section class="hsec">
        <h2 class="htitle">${t("going")} ${sub("going", 13)}</h2>
        <button class="card nearby-row" data-go="nearby">${icon("shops")}<span class="grow"><b>${t("nearby")}</b>${S.lang === "ko" ? "" : `<small>${KO_SUB.nearby_sub}</small>`}</span>${icon("chev")}</button>
      </section>
      ${S.aiMode === "demo" ? `<div class="demo-badge">${t("demo_badge")}</div>` : ""}
    </div>
  </div>${tabbar("home")}</section>`;
};

// 03 AI 질문
V.chat = () => {
  $app.innerHTML = `
  <section class="screen"><div class="scroll" id="chatScroll">
    ${topbar(t("askai_title"), "askai_title")}
    <div class="note">${icon("sparkle")}<span>${t("ai_note")}</span></div>
    <div class="msgs" id="msgs"></div>
  </div>
  <div class="chat-foot">
    <div class="quick">${["q_late", "q_laundry", "q_breakfast"].map((k) => `<button data-q="${k}_full">${t(k)}</button>`).join("")}</div>
    <form class="composer" id="form"><input id="inp" autocomplete="off" placeholder="${esc(t("placeholder"))}" enterkeyhint="send">
      <button type="button" class="mic" id="mic" aria-label="mic">${icon("mic")}</button>
      <button class="send" aria-label="send">${icon("send")}</button></form>
  </div>${tabbar("chat")}</section>`;
  const inp = $app.querySelector("#inp");
  $app.querySelector("#form").onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) { inp.value = ""; ask(v); } };
  $app.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => ask(t(b.dataset.q))));
  $app.querySelector("#mic").onclick = () => listen(inp);
  renderMsgs();
  if (S.autoMic) { S.autoMic = false; listen(inp); }
};

function msgHtml(m, i, arr) {
  if (m.from === "guest") return `<div class="bubble b-guest">${m.photo ? icon("photo", "") + " " + t("photo_sent") + (m.text && m.text !== "(photo)" ? "\n" + esc(m.text) : "") : esc(m.text)}</div>`;
  if (m.from === "owner") return `<div class="bubble b-owner"><span class="who">${t("reply_from")}</span>${esc(m.text)}</div>`;
  if (m.from === "system" && m.kind === "notified") return `<div class="sys">${icon("check")}<span>${t("notified_title")}</span></div>`;
  if (m.from !== "ai") return "";
  const later = arr.slice(i + 1);
  const isLast = !later.some((x) => x.from === "ai" || x.from === "guest");
  const notifiedAfter = later.some((x) => x.kind === "notified");
  let h = "";
  if (m.text || m.steps?.length) h += `<div class="bubble b-ai">${esc(m.text)}${m.steps?.length ? `<ol class="steps">${m.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}</div>`;
  if (m.sources?.length) h += `<div class="src">${icon("rules")}${t("from")} · ${m.sources.map((s) => esc((SOURCE_NAME[S.lang] || SOURCE_NAME.en)[s] || s)).join(", ")}</div>`;
  if (m.urgency === "emergency") h += `<div class="esc-card emg">${icon("emergency")}<a class="btn btn-primary" href="tel:119">${icon("phone")} ${t("call_119")}</a></div>`;
  else if (m.escalate && !notifiedAfter) h += `<div class="esc-card"><span>${t("owner_can_help")}</span><button class="btn btn-primary" data-call="ai">${icon("bell")} ${t("call_owner")}</button></div>`;
  else if (m.ask_if_solved && isLast && !S.answered.has(m.id)) h += `<div class="solved"><button class="btn btn-outline" data-yes="${m.id}">${t("yes_works")}</button><button class="btn btn-warn" data-no="${m.id}">${t("no_still")}</button></div>`;
  return h;
}

function renderMsgs() {
  const box = document.getElementById("msgs");
  if (!box) return;
  const all = [...S.thread, ...(S.pending ? [S.pending] : [])];
  box.innerHTML = all.map(msgHtml).join("") + (S.typing ? `<div class="typing"><i></i><i></i><i></i></div>` : "");
  box.querySelectorAll("[data-call]").forEach((b) => (b.onclick = () => openVerify("ai")));
  box.querySelectorAll("[data-yes]").forEach((b) => (b.onclick = () => { S.answered.add(b.dataset.yes); toast(t("glad")); renderMsgs(); }));
  box.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => { S.answered.add(b.dataset.no); ask(t("no_still")); }));
  const sc = document.getElementById("chatScroll");
  if (sc) sc.scrollTop = sc.scrollHeight;
}

async function ask(text, image) {
  if (S.typing) return;
  S.pending = { id: "tmp", from: "guest", text: image ? text : text, photo: !!image, ts: Date.now() };
  S.typing = true; renderMsgs();
  try {
    const r = await api("/api/ask", { method: "POST", body: { t: token, lang: S.lang, message: text, image } });
    S.pending = null; S.typing = false;
    await sync();
    if (r.ticketId) S.lastTicket = { id: r.ticketId, summaryKo: r.owner_summary_ko, time: hm() };
    renderMsgs();
    return r;
  } catch (e) {
    S.pending = null; S.typing = false; renderMsgs();
    if (e.status === 403) return render(true);
    if (!navigator.onLine) return showOffline();
    toast(t("err"));
  }
}
const hm = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

// 음성 입력 (브라우저 지원 시)
function listen(inp) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { inp.focus(); return; }
  const mic = document.getElementById("mic");
  const rec = new SR(); rec.lang = SPEECH[S.lang] || "en-US"; rec.interimResults = true;
  mic?.classList.add("rec"); inp.placeholder = t("listening");
  rec.onresult = (e) => { inp.value = [...e.results].map((r) => r[0].transcript).join(""); if (e.results[e.results.length - 1].isFinal) { const v = inp.value.trim(); inp.value = ""; if (v) ask(v); } };
  rec.onend = rec.onerror = () => { mic?.classList.remove("rec"); inp.placeholder = t("placeholder"); };
  rec.start();
}

// 04 문제 해결 (4종)
const FIX = {
  hot: { title: "fix_hot", steps: ["hot_s1", "hot_s2", "hot_s3"], no: "no_cold", visual: () => `
    <div class="panel-screen">온수&nbsp;&nbsp; ${t("hot_on")}</div>
    <div class="panel-btns"><span class="pbtn hot"><span class="dot">온수</span>${t("press_this")}</span><span class="pbtn"><span class="dot">난방</span>${t("heating")}</span></div>
    <div class="cap">${t("panel_cap")}${S.lang === "ko" ? "" : " · " + KO_SUB.panel}</div>` },
  temp: { title: "fix_temp", steps: ["temp_s1", "temp_s2", "temp_s3"], no: "no_still", visual: () => `
    <div class="panel-screen">난방&nbsp;&nbsp; 24°C</div>
    <div class="panel-btns"><span class="pbtn hot"><span class="dot">난방</span>${t("press_this")}</span><span class="pbtn"><span class="dot">▲▼</span>24°C</span><span class="pbtn"><span class="dot">운전</span>${t("t_air")}</span></div>
    <div class="cap">${t("temp_cap")}</div>` },
  wifi: { title: "fix_wifi", steps: ["wifi_s1", "wifi_s2", "wifi_s3"], no: "no_offline", visual: () => `
    <div class="wifi-rows">
      <div class="wifi-row"><span class="grow"><small>${t("w_network")}${S.lang === "ko" ? "" : " · 네트워크"}</small><b>${esc(S.stay.wifi_ssid)}</b></span></div>
      <div class="wifi-row"><span class="grow"><small>${t("w_password")}${S.lang === "ko" ? "" : " · 비밀번호"}</small><b>${esc(S.stay.wifi_pass)}</b></span>
        <button class="copy-btn" data-copy-pw>${icon("copy")}${t("copy")}</button></div>
    </div>
    <div class="cap">${t("w_same")}${S.lang === "ko" ? "" : " · 모든 객실 동일"}</div>` },
  door: { title: "fix_door", steps: ["door_s1", "door_s2", "door_s3"], no: "no_still", visual: () => `
    <div class="panel-btns" style="margin-top:0"><span class="pbtn hot"><span class="dot">${icon("door")}</span>${t("press_this")}</span><span class="pbtn"><span class="dot">${icon("lock")}</span>${t("p_door")}</span></div>
    <div class="cap">${t("door_cap")}</div>` },
};
V.fix = (id) => {
  const f = FIX[id] || FIX.hot;
  $app.innerHTML = `
  <section class="screen"><div class="scroll">
    ${topbar(t(f.title), "fix_" + id)}
    <div class="card visual">${f.visual()}</div>
    <ol class="fix-steps">${f.steps.map((k) => `<li><span><b>${esc(t(k, { ssid: S.stay.wifi_ssid }))}</b><small>${esc(t(k + "d", { ssid: S.stay.wifi_ssid }))}</small></span></li>`).join("")}</ol>
  </div>
  <div class="didwork"><h3>${t("did_work")}</h3><div class="row">
    <button class="btn btn-outline" id="yes">${t("yes_works")}</button>
    <button class="btn btn-warn" id="no">${t(f.no)}</button></div></div>
  ${tabbar("home")}</section>`;
  $app.querySelector("#yes").onclick = () => { toast(t("glad")); go(""); };
  $app.querySelector("#no").onclick = () => openVerify(id);
  $app.querySelector("[data-copy-pw]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(S.stay.wifi_pass); } catch {} toast(t("copied")); });
};

// 05 사장님 연결됨
V.notified = () => {
  const tk = S.lastTicket || lastNotified();
  const langName = LANG_NAME_IN[S.lang]?.[S.lang] || "English";
  $app.innerHTML = `
  <section class="screen"><div class="scroll">
    ${topbar(t("help"), "notified_title")}
    <div class="center"><div class="big-ok">${icon("check")}</div>
      <h2>${t("notified_title")}</h2><p>${t("notified_desc", { lang: langName })}</p></div>
    ${tk ? `<div class="card owner-sees"><small>${t("owner_sees")}${S.lang === "ko" ? "" : " · " + KO_SUB.owner_sees}</small>
      <div class="alert">${icon("bell")}<div><b>${esc(tk.summaryKo || "")}</b><span>${esc(tk.time || "")}</span></div></div></div>` : ""}
    <div class="card reply-box" id="replyBox"></div>
  </div>
  <div class="stack"><button class="btn btn-outline" data-go="chat">${t("ask_else")}</button>
    <a class="link-warn" href="tel:119">${icon("phone")}${t("emergency_link")}</a></div>
  ${tabbar("help")}</section>`;
  renderReplies();
};
function lastNotified() {
  const m = [...S.thread].reverse().find((x) => x.kind === "notified");
  return m ? { id: m.ticketId, summaryKo: m.summaryKo, time: new Date(m.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }) } : null;
}
function renderReplies() {
  const box = document.getElementById("replyBox");
  if (!box) return;
  const tk = S.lastTicket || lastNotified();
  const replies = S.thread.filter((m) => m.from === "owner" && (!tk || m.ticketId === tk.id));
  box.innerHTML = replies.length
    ? `<small>${t("reply_from")}</small>${replies.map((r) => `<p>${esc(r.text)}</p>`).join("")}`
    : `<div class="wait"><span class="typing" style="border:0;padding:0"><i></i><i></i><i></i></span>${t("waiting")}</div>`;
}

// 07 사진으로 묻기
V.photo = () => {
  const p = S.photo;
  const a = p?.answer;
  $app.innerHTML = `
  <section class="screen"><div class="scroll">
    ${topbar(t("photo_title"), "photo_title")}
    <button class="photo-box" id="pick">${p?.url ? `<img src="${p.url}" alt="">` : `${icon("photo")}<b>${t("take_photo")}</b><span>${t("take_photo_d")}</span>`}</button>
    <input type="file" id="file" accept="image/*" capture="environment" hidden>
    ${p ? `<div class="msgs" style="margin-top:12px"><div class="bubble b-guest">${t("how_use")}</div>${p.loading ? `<div class="typing"><i></i><i></i><i></i></div>` : ""}</div>` : ""}
    ${a ? `<div class="card answer-card"><div class="t">${icon("sparkle")}<span>${esc(a.answer)}</span></div>
      ${a.steps?.length ? `<ol class="steps">${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
      ${a.sources?.length ? `<div class="src" style="margin:10px 0 0">${icon("rules")}${t("from")} · ${a.sources.map((s) => esc((SOURCE_NAME[S.lang] || SOURCE_NAME.en)[s] || s)).join(", ")}</div>` : ""}
      ${a.escalate && a.urgency !== "emergency" ? `<button class="btn btn-primary" style="margin-top:12px" data-call>${icon("bell")} ${t("call_owner")}</button>` : ""}
    </div>` : ""}
  </div>
  ${p ? `<div class="stack"><button class="btn btn-outline" id="again">${t("take_another")}</button></div>` : ""}
  ${tabbar("chat")}</section>`;
  const file = $app.querySelector("#file");
  $app.querySelector("#pick").onclick = () => file.click();
  $app.querySelector("#again")?.addEventListener("click", () => file.click());
  $app.querySelector("[data-call]")?.addEventListener("click", () => openVerify("ai"));
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    const url = await shrink(f);
    S.photo = { url, loading: true }; V.photo();
    const r = await ask(t("how_use"), url);
    S.photo = { url, loading: false, answer: r || { answer: t("err"), steps: [] } };
    if (location.hash === "#photo") V.photo();
  };
};
function shrink(file, max = 1024) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.8)); URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

// 08 본인 확인 (사장님 호출 · 문의 전)
function openVerify(topic) {
  nameSheet(async (lastName) => {
    const r = await api("/api/escalate", { method: "POST", body: { t: token, lastName, topic, lang: S.lang } });
    S.verifiedName = lastName;
    S.lastTicket = { id: r.ticketId, summaryKo: r.summaryKo, time: r.time };
    await sync(); go("notified");
  });
}
function nameSheet(onSubmit, label) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<form class="sheet" id="vf"><div class="grabber"></div>
    <div class="big-lock" style="width:56px;height:56px;margin-bottom:14px">${icon("lock")}</div>
    <h2>${t("verify_title")}</h2><p>${t("verify_desc")}${S.lang === "ko" ? "" : "<br>" + KO_SUB.verify}</p>
    <div class="field"><label for="ln">${t("last_name")}</label><input id="ln" autocomplete="family-name" autocapitalize="characters" required></div>
    <div class="field-note">${icon("lock")}<span>${t("verify_note")}</span></div>
    <div class="err hidden" id="verr"></div>
    <button class="btn btn-primary" id="vgo">${label || t("call_owner")}</button>
    <button type="button" class="cancel" id="vc">${t("cancel")}</button></form>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector("#vc").onclick = close;
  setTimeout(() => wrap.querySelector("#ln").focus(), 100);
  wrap.querySelector("#vf").onsubmit = async (e) => {
    e.preventDefault();
    const btn = wrap.querySelector("#vgo"), err = wrap.querySelector("#verr");
    btn.disabled = true; err.classList.add("hidden");
    try { await onSubmit(wrap.querySelector("#ln").value); close(); }
    catch (x) {
      btn.disabled = false;
      err.textContent = x.status === 401 ? t("name_mismatch") : x.status === 429 ? t("too_many") : t("err");
      err.classList.remove("hidden");
    }
  };
}

// 09 만료
V.expired = () => {
  $app.innerHTML = `<section class="screen"><div class="full-center center">
    <div class="big-lock">${icon("lock")}</div><h2>${t("expired_title")}</h2><p>${t("expired_desc")}</p>
    <div><span class="ko-chip">${KO_SUB.expired}</span></div></div>
    <div class="stack"><a class="btn btn-outline" href="tel:1330">${t("hotline")}</a><div class="foot-note" style="margin:0">${t("hotline_sub")}</div></div></section>`;
};

// 10 오프라인
function showOffline() {
  S.offline = true;
  const s = S.stay;
  $app.innerHTML = `<section class="screen"><div class="scroll center" style="padding-top:40px">
    <div class="offline-ico">${icon("alertOff")}</div><h2>${t("offline_title")}</h2><p>${t("offline_desc")}${S.lang === "ko" ? "" : " · " + KO_SUB.offline}</p>
    <div class="mini-rows">
      ${s ? `<div class="card"><span class="icon-box">${icon("wifi")}</span><span><small>${t("wifi_pw")} · ${esc(s.wifi_ssid)}</small><b>${esc(s.wifi_pass)}</b></span></div>
      <div class="card"><span class="icon-box">${icon("clock")}</span><span><small>${t("checkout")}</small><b>${esc(fmtCheckout(s.checkout).short)}</b></span></div>` : ""}
      <a class="card" href="tel:119"><span class="icon-box">${icon("phone")}</span><span><small>${t("emergency")}</small><b>${t("em_line")}</b></span></a>
    </div></div>
    <div class="stack"><button class="btn btn-primary" id="retry">${t("retry")}</button></div></section>`;
  $app.querySelector("#retry").onclick = () => location.reload();
}

// 11 주변
V.nearby = () => {
  const P = [
    ["n_gukbap", "할매국밥", 4, t("until", { t: "22:00" }), "n_gukbap_d"],
    ["n_pharm", "모아약국", 6, t("until", { t: "21:00" }), "n_pharm_d"],
    ["n_conv", "모아편의점", 1, t("h24"), "n_conv_d"],
  ];
  $app.innerHTML = `<section class="screen"><div class="scroll">
    ${topbar(t("nearby_title"), "nearby_title")}
    <div class="places">${P.map(([n, k, m, open, d]) => `
      <div class="card place"><div class="top"><span class="icon-box">${icon("shops")}</span><div><b>${t(n)}</b><div class="meta">${S.lang === "ko" ? "" : k + " · "}${t("walk", { m })} · ${open}</div></div></div>
      <p>${t(d)}</p><a class="map-btn" target="_blank" rel="noopener" href="https://map.naver.com/p/search/${encodeURIComponent(k)}">${icon("shops")}${t("map")}</a></div>`).join("")}</div>
  </div>${tabbar("home")}</section>`;
};

// 객실 안내 상세 (에어컨 · 분리수거 · 하우스 규칙)
V.guide = (id) => {
  const g = GUIDE[id] || GUIDE.air, L = g[S.lang] || g.en, U = GUIDE_UI[S.lang] || GUIDE_UI.en;
  const vis = g.visual ? `<div class="card visual guide-vis">
      <div class="gv-title">${esc(g.visual.title)}</div>
      <div class="panel-btns">${g.visual.keys.map(([k, n], i) => `<span class="pbtn ${i === 0 ? "hot" : ""}"><span class="dot">${esc(k)}</span>${esc(L.keyNames[n])}</span>`).join("")}</div>
      <div class="cap">${esc(L.where)}</div></div>`
    : `<div class="card visual guide-vis"><div class="icon-box" style="margin:0 auto 10px">${icon(g.icon)}</div><div class="cap" style="margin:0">${esc(L.where)}</div></div>`;
  $app.innerHTML = `
  <section class="screen"><div class="scroll">
    ${topbar(L.title, null, g.koSub)}
    ${vis}
    <h3 class="sub-h">${id === "rules" ? U.rules_h : U.how}</h3>
    <ol class="fix-steps" style="margin-top:10px">${L.steps.map(([a, b]) => `<li><span><b>${esc(a)}</b><small>${esc(b)}</small></span></li>`).join("")}</ol>
    ${L.tips?.length ? `<div class="note" style="margin-top:20px">${icon("sparkle")}<span><b style="display:block;margin-bottom:2px">${U.good}</b>${L.tips.map(esc).join("<br>")}</span></div>` : ""}
    <div class="pad" style="margin-top:16px"><button class="btn btn-outline" data-go="help">${icon("chat")}${U.ask_owner}</button></div>
  </div>${tabbar("home")}</section>`;
};

// Help 탭 = 사장님께 문의 (본인 확인 후 전송 → 사장님에게 한국어로, 답장은 손님 언어로)
V.help = () => {
  const M = MSG_UI[S.lang] || MSG_UI.en;
  $app.innerHTML = `
  <section class="screen"><div class="scroll" id="helpScroll">
    <header class="topbar"><div><h1 style="font-size:22px">${M.title}</h1>${S.lang === "ko" ? "" : `<span class="ko">사장님께 문의</span>`}</div></header>
    <div class="note">${icon("chat")}<span>${M.desc}</span></div>
    <div class="msgs" id="helpMsgs"></div>
  </div>
  <div class="help-foot">
    <form class="msg-box" id="msgForm"><textarea id="msgText" rows="3" maxlength="500" placeholder="${esc(M.ph)}"></textarea>
      <button class="btn btn-primary" id="msgSend">${icon("send")}${M.send}</button></form>
    <div class="night-note">${M.night}</div>
    <div class="urgent-row"><span>${M.urgent}</span><a href="tel:119">${icon("phone")}119</a><a href="tel:1330">${icon("phone")}1330</a></div>
  </div>${tabbar("help")}</section>`;
  renderHelpMsgs();
  $app.querySelector("#msgForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $app.querySelector("#msgText").value.trim();
    if (!text) return $app.querySelector("#msgText").focus();
    const send = async (lastName) => {
      await api("/api/message", { method: "POST", body: { t: token, lastName, text, lang: S.lang } });
      S.verifiedName = lastName;
      $app.querySelector("#msgText").value = "";
      await sync(); renderHelpMsgs(); toast(M.sent);
    };
    if (S.verifiedName) send(S.verifiedName).catch(() => { S.verifiedName = null; nameSheet(send, M.send); });
    else nameSheet(send, M.send);
  };
};
function renderHelpMsgs() {
  const box = document.getElementById("helpMsgs");
  if (!box) return;
  const M = MSG_UI[S.lang] || MSG_UI.en;
  const list = S.thread.filter((m) => (m.from === "guest" && m.via === "help") || m.from === "owner");
  box.innerHTML = list.length
    ? list.map((m) => m.from === "owner"
        ? `<div class="bubble b-owner">${esc(m.text)}</div><div class="src">${icon("check")}${t("reply_from")}${S.lang === "ko" ? "" : " · 사장님 답장"}</div>`
        : `<div class="bubble b-guest">${esc(m.text)}</div>`).join("")
    : `<div class="empty-msg">${M.empty}</div>`;
  const sc = document.getElementById("helpScroll"); if (sc) sc.scrollTop = sc.scrollHeight;
}

// ---------- 라우팅 · 동기화 ----------
function render(expired) {
  if (expired) return V.expired();
  if (S.offline) return showOffline();
  if (!S.stay) return;
  const h = location.hash.slice(1);
  if (!S.lang || !S.langDone || h === "lang") return V.lang();
  document.documentElement.lang = S.lang;
  if (h === "chat") return V.chat();
  if (h.startsWith("fix-")) return V.fix(h.slice(4));
  if (h === "notified") return V.notified();
  if (h === "photo") return V.photo();
  if (h === "nearby") return V.nearby();
  if (h === "help") return V.help();
  if (h.startsWith("guide-")) return V.guide(h.slice(6));
  V.home();
}

async function sync() {
  try {
    const r = await api(`/api/thread?t=${encodeURIComponent(token)}&since=${S.lastTs}`);
    if (r.expired) return render(true);
    if (r.messages?.length) {
      S.thread.push(...r.messages);
      S.lastTs = Math.max(S.lastTs, ...r.messages.map((m) => m.ts));
      return true;
    }
  } catch {}
  return false;
}

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  if (e.target.closest("[data-back]")) { e.preventDefault(); back(); }
});
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
window.addEventListener("offline", showOffline);
window.addEventListener("online", () => { if (S.offline) location.reload(); });

setInterval(async () => {
  if (document.hidden || !S.stay || S.offline) return;
  if (await sync()) {
    const h = location.hash.slice(1);
    if (h === "chat") renderMsgs();
    if (h === "notified") renderReplies();
    if (h === "help") renderHelpMsgs();
  }
}, 4000);

(async function boot() {
  if (!token) { $app.innerHTML = `<div class="full-center center"><h2>Moa Stay</h2><p>${t("not_found")}</p><p style="margin-top:20px"><a class="btn btn-primary" href="/k/demo203">Demo: Room 203</a></p></div>`; return; }
  const cached = localStorage.getItem(LS("stay"));
  try {
    const r = await api(`/api/card?t=${encodeURIComponent(token)}`);
    if (r.expired) { localStorage.removeItem(LS("stay")); return V.expired(); }
    S.stay = r.stay; S.aiMode = r.aiMode;
    localStorage.setItem(LS("stay"), JSON.stringify(r.stay));
    await sync();
    render();
  } catch (e) {
    if (e.status === 404) { $app.innerHTML = `<div class="full-center center"><div class="big-lock">${icon("lock")}</div><p>${t("not_found")}</p></div>`; return; }
    if (cached) S.stay = JSON.parse(cached);
    showOffline();
  }
})();
