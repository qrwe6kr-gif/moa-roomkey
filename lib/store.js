// 저장소: Vercel의 Upstash Redis(Marketplace 연동)가 있으면 그걸 쓰고, 없으면 메모리에 저장합니다.
// 메모리 저장은 로컬 테스트용입니다. Vercel에 올릴 때는 반드시 Redis를 연결하세요(README 참고).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasRedis = Boolean(URL_ && TOKEN);

const mem = globalThis.__moaMem || (globalThis.__moaMem = new Map());

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("Redis error " + r.status);
  return (await r.json()).result;
}

const P = "moa:";

export async function get(key, fallback = null) {
  if (!hasRedis) return mem.has(key) ? structuredClone(mem.get(key)) : fallback;
  const v = await redis(["GET", P + key]);
  return v == null ? fallback : JSON.parse(v);
}

export async function set(key, value) {
  if (!hasRedis) { mem.set(key, structuredClone(value)); return; }
  await redis(["SET", P + key, JSON.stringify(value)]);
}

// 배열에 항목을 추가하고 최근 max개만 남깁니다.
export async function push(key, item, max = 300) {
  const arr = await get(key, []);
  arr.push(item);
  await set(key, arr.slice(-max));
  return item;
}

export async function update(key, fn, fallback = null) {
  const v = await get(key, fallback);
  const next = await fn(v);
  await set(key, next);
  return next;
}
