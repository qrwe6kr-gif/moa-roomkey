// API 키 없이도 화면 흐름을 확인할 수 있는 데모 답변입니다. (실제 시연·영상은 OpenAI 키를 넣고 찍으세요)
// 키워드로 매뉴얼 항목을 찾아 미리 쓴 답을 돌려줍니다. 영어·일본어·한국어·중국어만 준비, 나머지는 영어.

const R = {
  hot: {
    k: ["hot water", "shower", "お湯", "温水", "シャワー", "온수", "뜨거운 물", "热水", "nước nóng", "น้ำร้อน"],
    src: ["hot_water_heating"], ask: true,
    en: ["Let's turn on the hot water. It takes about 5 minutes.", ["Find the panel on the wall next to the entrance", "Press the red \"온수\" (hot water) button", "Wait 5 minutes, then try the shower"]],
    ja: ["お湯を出しましょう。5分ほどかかります。", ["入口横の壁にある操作パネルを見つけてください", "赤い「온수」(お湯)ボタンを押してください", "5分待ってからシャワーをお試しください"]],
    ko: ["온수를 켜 볼게요. 5분 정도 걸려요.", ["현관 옆 벽의 보일러 조절기를 찾아 주세요", "빨간 '온수' 버튼을 눌러 주세요", "5분 기다린 뒤 샤워기를 틀어 보세요"]],
    zh: ["我们来打开热水,大约需要5分钟。", ["找到门口旁墙上的控制面板", "按下红色的“온수”(热水)按钮", "等5分钟后再试淋浴"]],
  },
  wifi: {
    k: ["wifi", "wi-fi", "internet", "password", "ワイファイ", "パスワード", "와이파이", "비밀번호", "无线", "密码", "mật khẩu", "รหัส"],
    src: ["wifi"], ask: false,
    en: ["Wi-Fi: MOA_{room}, password moa2026.", []],
    ja: ["Wi-Fiは MOA_{room}、パスワードは moa2026 です。", []],
    ko: ["와이파이는 MOA_{room}, 비밀번호는 moa2026이에요.", []],
    zh: ["Wi-Fi 名称 MOA_{room},密码 moa2026。", []],
  },
  luggage: {
    k: ["luggage", "bag", "荷物", "짐", "行李", "hành lý", "กระเป๋า"],
    src: ["luggage"], ask: false,
    en: ["Yes! You can leave it on the 1st floor for free until 18:00 after check-out.", []],
    ja: ["はい、チェックアウト後18:00まで1階で無料でお預かりします。", []],
    ko: ["네! 체크아웃 후 18:00까지 1층 짐 보관함을 무료로 쓸 수 있어요.", []],
    zh: ["可以!退房后到18:00可免费寄存在1楼。", []],
  },
  late: {
    k: ["late check", "check-out", "checkout", "チェックアウト", "체크아웃", "退房", "trả phòng", "เช็คเอาท์"],
    src: ["checkout_fees"], ask: false,
    en: ["Check-out is 11:00. Late check-out is ₩10,000 per hour until 14:00 at most; please ask the front desk by 23:00 the day before.", []],
    ja: ["チェックアウトは11:00です。レイトチェックアウトは1時間10,000ウォン(最大14:00)で、前日23:00までにフロントへお申し付けください。", []],
    ko: ["체크아웃은 11:00예요. 레이트 체크아웃은 1시간 10,000원(최대 14:00)이고, 전날 23:00까지 프런트에 요청해 주세요.", []],
    zh: ["退房时间为11:00。延迟退房每小时10,000韩元,最晚14:00,请在前一天23:00前向前台申请。", []],
  },
  pharmacy: {
    k: ["pharmacy", "medicine", "薬", "약국", "药", "nhà thuốc", "ร้านยา"],
    src: ["nearby"], ask: false,
    en: ["Moa Pharmacy is a 6-minute walk and open 09:00–21:00.", []],
    ja: ["モア薬局は徒歩6分、09:00〜21:00営業です。", []],
    ko: ["모아약국은 도보 6분, 09:00~21:00 영업해요.", []],
    zh: ["Moa药店步行6分钟,营业时间09:00–21:00。", []],
  },
  breakfast: {
    k: ["breakfast", "朝食", "조식", "早餐", "bữa sáng", "อาหารเช้า"],
    src: ["lobby"], ask: false,
    en: ["Breakfast isn't included. The 1st-floor lobby has a microwave and water dispenser, open 24 hours.", []],
    ja: ["朝食はございません。1階ロビーに電子レンジとウォーターサーバーがあり、24時間使えます。", []],
    ko: ["조식은 없어요. 1층 로비 전자레인지와 정수기는 24시간 쓸 수 있어요.", []],
    zh: ["不提供早餐。1楼大厅有微波炉和饮水机,24小时可用。", []],
  },
  laundry: {
    k: ["laundry", "wash", "洗濯", "세탁", "빨래", "洗衣", "giặt", "ซักผ้า"],
    src: ["laundry"], ask: false,
    en: ["There's no washer here. Moa Laundromat is a 3-minute walk, open 24 hours: ₩4,000 to wash, ₩4,000 to dry.", []],
    ja: ["館内に洗濯機はありません。徒歩3分の24時間コインランドリー(洗濯4,000ウォン・乾燥4,000ウォン)をご利用ください。", []],
    ko: ["숙소에 세탁기는 없어요. 도보 3분 24시간 모아빨래방(세탁 4,000원, 건조 4,000원)을 이용해 주세요.", []],
    zh: ["店内没有洗衣机。步行3分钟有24小时自助洗衣店,洗衣4,000韩元、烘干4,000韩元。", []],
  },
  air: {
    k: ["air con", "aircon", "air conditioner", "エアコン", "에어컨", "空调", "máy lạnh", "แอร์"],
    src: ["aircon"], ask: true,
    en: ["The remote is on the bedside table.", ["Press \"운전\" (power) to turn it on", "Press \"운전선택\" (mode) for cool / heat", "Set the temperature with ▲▼"]],
    ja: ["リモコンはベッド横のテーブルにあります。", ["「운전」(運転)ボタンで電源を入れます", "「운전선택」(運転切替)で冷房・暖房を選びます", "▲▼で温度を調整します"]],
    ko: ["리모컨은 침대 옆 협탁에 있어요.", ["'운전' 버튼으로 켜 주세요", "'운전선택'으로 냉방·난방을 고르세요", "▲▼로 온도를 맞추세요"]],
    zh: ["遥控器在床头柜上。", ["按“운전”(开关)开机", "按“운전선택”(模式)选择制冷/制热", "用▲▼调节温度"]],
  },
  trash: {
    k: ["trash", "garbage", "recycl", "ゴミ", "쓰레기", "분리수거", "垃圾", "rác", "ขยะ"],
    src: ["trash"], ask: false,
    en: ["General trash goes in your room bin. Bottles, cans and food waste go to the bins next to the 1st-floor elevator.", []],
    ja: ["一般ゴミは客室のゴミ箱へ。ペットボトル・缶・生ゴミは1階エレベーター横の分別箱へお願いします。", []],
    ko: ["일반 쓰레기는 객실 휴지통에, 페트병·캔·음식물은 1층 엘리베이터 옆 분리수거함에 버려 주세요.", []],
    zh: ["一般垃圾放房间垃圾桶。塑料瓶、易拉罐和厨余垃圾请放到1楼电梯旁的分类箱。", []],
  },
  rules: {
    k: ["rule", "smok", "quiet", "ルール", "禁煙", "규칙", "흡연", "规定", "吸烟", "quy định", "กฎ"],
    src: ["rules"], ask: false,
    en: ["No smoking anywhere inside (cleaning fee ₩100,000), please keep quiet after 22:00, and no unregistered visitors or pets.", []],
    ja: ["館内は全面禁煙(清掃費100,000ウォン)、22:00以降はお静かに。予約外の方やペットは入れません。", []],
    ko: ["전 객실 금연(특수 청소비 100,000원), 22:00 이후 조용히, 예약하지 않은 외부인·반려동물은 출입할 수 없어요.", []],
    zh: ["室内全面禁烟(清洁费100,000韩元),22:00后请保持安静,未登记访客和宠物不可入内。", []],
  },
  emergency: {
    k: ["fire", "smoke", "gas", "injur", "火事", "煙", "ガス", "화재", "연기", "가스", "다쳤", "火灾", "煤气", "cháy", "ไฟไหม้"],
    src: ["emergency"], ask: false, urgency: "emergency",
    en: ["Call 119 now and leave the building if there is fire or gas. I've alerted the owner too.", []],
    ja: ["今すぐ119に電話し、火事やガスの場合は建物の外へ避難してください。オーナーにも知らせました。", []],
    ko: ["지금 바로 119에 신고하고, 화재나 가스라면 건물 밖으로 대피하세요. 사장님에게도 알렸어요.", []],
    zh: ["请立即拨打119,如有火灾或煤气泄漏请离开建筑物。我也已通知老板。", []],
  },
};

const UNKNOWN = {
  en: "I don't have that in the house guide, so I'm asking the owner for you.",
  ja: "その情報は館内ガイドにないため、オーナーに確認します。",
  ko: "그 내용은 숙소 안내에 없어서 사장님께 여쭤볼게요.",
  zh: "住宿指南里没有这项信息,我来帮您问老板。",
  vi: "Thông tin này không có trong hướng dẫn, tôi sẽ hỏi chủ nhà giúp bạn.",
  th: "ข้อมูลนี้ไม่มีในคู่มือที่พัก ฉันจะสอบถามเจ้าของให้นะคะ",
};
const PHOTO = {
  en: ["This looks like your boiler panel.", ["Hot water: press the red \"온수\" button, then wait 5 minutes", "Heating: press \"난방\", then set the temperature with ▲▼ (24°C is comfy)"]],
  ja: ["ボイラーの操作パネルのようです。", ["お湯:赤い「온수」ボタンを押して5分待ちます", "暖房:「난방」を押し、▲▼で温度を設定します(24°Cがおすすめ)"]],
  ko: ["보일러 조절기로 보여요.", ["온수: 빨간 '온수' 버튼을 누르고 5분 기다리세요", "난방: '난방'을 누르고 ▲▼로 온도를 맞추세요(24도 권장)"]],
  zh: ["这看起来是锅炉控制面板。", ["热水:按红色“온수”按钮,等5分钟", "地暖:按“난방”,用▲▼设定温度(24°C较舒适)"]],
};
const STILL = { en: "Sorry it's still not working. The owner can check it for you.", ja: "まだ直らず申し訳ありません。オーナーに確認してもらいましょう。", ko: "아직 안 된다니 죄송해요. 사장님께 확인을 요청할게요.", zh: "抱歉还是不行,我请老板来帮您看看。" };
const OWNER_KO = { hot: "보일러 온수 문제", wifi: "와이파이 문의", air: "에어컨 문의" };

export function demoAnswer({ room, lang, message = "", hasImage }) {
  const L = (o) => o[lang] || o.en;
  const base = { language: o2lang(lang), steps: [], ask_if_solved: false, sources: [], escalate: false, urgency: "none", owner_summary_ko: "", grounded: true };
  if (hasImage) {
    const [a, s] = L(PHOTO);
    return { ...base, intent: "facility", answer: a, steps: s, ask_if_solved: true, sources: ["hot_water_heating"] };
  }
  const m = message.toLowerCase();
  const order = ["emergency", ...Object.keys(R).filter((k) => k !== "emergency")];
  for (const id of order) {
    const r = R[id];
    if (r.k.some((k) => m.includes(k))) {
      const [a, s] = L(r);
      const out = { ...base, intent: id === "emergency" ? "emergency" : ["hot", "wifi", "air"].includes(id) ? "facility" : "info", answer: a.replace("{room}", room), steps: s, ask_if_solved: r.ask, sources: r.src };
      if (r.urgency === "emergency") Object.assign(out, { escalate: true, urgency: "emergency", owner_summary_ko: `${room}호 긴급 상황: 손님이 화재·가스·부상 관련 신고. 즉시 확인 필요` });
      if (/still|まだ|아직|还是|vẫn|ยัง/.test(m) && OWNER_KO[id]) Object.assign(out, { answer: L(STILL), escalate: true, urgency: "urgent", ask_if_solved: false, steps: [], owner_summary_ko: `${room}호 ${OWNER_KO[id]}: 안내대로 했는데도 해결 안 됨. 확인 필요` });
      return out;
    }
  }
  return { ...base, intent: "other", answer: L(UNKNOWN), grounded: false, escalate: true, urgency: "normal", owner_summary_ko: `${room}호 문의(매뉴얼에 없음): "${message.slice(0, 40)}"` };
}
const o2lang = (l) => (["en", "ja", "zh", "ko", "vi", "th"].includes(l) ? l : "en");

const TR = {
  "지금 올라갈게요. 5분만 기다려 주세요.": { en: "I'm coming up now. Please wait 5 minutes.", ja: "今すぐ伺います。5分ほどお待ちください。", zh: "我现在就上去,请稍等5分钟。", vi: "Tôi lên ngay đây. Vui lòng đợi 5 phút.", th: "กำลังขึ้นไปเดี๋ยวนี้ค่ะ กรุณารอ 5 นาทีนะคะ" },
  "지금 올라갈게요.": { en: "I'm coming up now.", ja: "今すぐ伺います。", zh: "我现在就上去。", vi: "Tôi lên ngay đây.", th: "กำลังขึ้นไปเดี๋ยวนี้ค่ะ" },
};
export function demoTranslate(text, lang) {
  const hit = TR[text.trim()];
  if (hit && hit[lang]) return hit[lang];
  return `${text}  (데모 모드: AI 키를 넣으면 ${lang}로 번역됩니다)`;
}

export function demoMemo(logs) {
  const total = logs.length;
  const open = logs.filter((l) => l.escalate && !l.resolved);
  const solved = total - logs.filter((l) => l.escalate).length;
  return `1. 한 줄 요약: 밤사이 문의 ${total}건, AI 자동 해결 ${solved}건, 확인 필요 ${open.length}건\n2. 지금 확인할 것: ${open.length ? open.map((l) => l.owner_summary_ko).join(" / ") : "없음"}\n3. AI가 해결한 문의: (데모 모드)\n4. 매뉴얼 보완 제안: ${logs.some((l) => l.grounded === false) ? "매뉴얼에 없던 질문을 확인해 항목을 추가하세요" : "없음"}`;
}
