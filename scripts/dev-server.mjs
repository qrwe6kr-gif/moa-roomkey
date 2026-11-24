// 로컬 테스트 서버: Vercel과 같은 주소 구조로 public/ 과 api/ 를 띄웁니다.
// 사용: npm run dev  →  http://localhost:3000/k/demo203 (손님) · http://localhost:3000/owner (사장님, PIN 0000)
// .env.local 파일이 있으면 읽습니다 (OPENAI_API_KEY 등). 이 파일은 GitHub에 올리지 마세요.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const handlers = {};

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let p = u.pathname;
  try {
    if (p.startsWith("/api/")) {
      const name = p.slice(5).replace(/[^a-z]/g, "");
      handlers[name] ||= (await import(path.join(root, "api", name + ".js"))).default;
      return await handlers[name](req, res);
    }
    if (/^\/k\/[^/]+$/.test(p)) p = "/index.html";
    if (p === "/owner") p = "/owner.html";
    if (p === "/") p = "/index.html";
    const file = path.join(root, "public", path.normalize(p));
    if (!file.startsWith(path.join(root, "public")) || !(await stat(file).catch(() => null))?.isFile()) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e.message) }));
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}/k/demo203  ·  /owner (PIN ${process.env.OWNER_PIN || "0000"})  ·  AI: ${process.env.OPENAI_API_KEY ? "OpenAI" : "데모 모드"}`));
