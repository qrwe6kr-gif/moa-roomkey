// promptpack/ 폴더의 매뉴얼·프롬프트를 서버 코드가 import할 수 있는 lib/promptpack.js로 묶습니다.
// 프롬프트나 매뉴얼을 고친 뒤: npm run pack
import { readFile, writeFile } from "node:fs/promises";
const r = (p) => readFile(new URL("../promptpack/" + p, import.meta.url), "utf8");
const clean = (md) => md.replace(/<!--[\s\S]*?-->/g, "").trim();
const out = {
  manual: JSON.parse(await r("manual/moa_stay_manual.json")),
  schema: JSON.parse(await r("schema/guest_response.schema.json")),
  guest: clean(await r("prompts/01_guest_host.md")),
  reply: clean(await r("prompts/02_owner_reply_translate.md")),
  memo: clean(await r("prompts/03_handover_memo.md")),
};
await writeFile(new URL("../lib/promptpack.js", import.meta.url),
  "// 자동 생성 파일입니다. 직접 고치지 말고 promptpack/ 을 고친 뒤 npm run pack 을 실행하세요.\nexport default " + JSON.stringify(out, null, 1) + ";\n");
console.log("lib/promptpack.js 생성 완료");
