// Vercel 함수와 로컬 개발 서버 양쪽에서 똑같이 동작하는 작은 도우미입니다.

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function query(req) {
  const u = new URL(req.url, "http://x");
  return Object.fromEntries(u.searchParams);
}

export const uid = (n = 10) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  for (const b of bytes) s += a[b % a.length];
  return s;
};

export const SUPPORTED = ["en", "ja", "zh", "ko", "vi", "th"];
export const normLang = (l) => (SUPPORTED.includes(l) ? l : "en");

export function kstTime(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
}
