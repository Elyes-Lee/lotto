// ===== 팔괘(Trigram) 정의 =====
// bit pattern is bottom->top (3 bits): 111=乾, 000=坤 ...
const TRIGRAMS = {
  "111": { key:"qian",  name:"건(乾)", symbol:"☰", nature:"하늘", element:"금(金)" },
  "110": { key:"dui",   name:"태(兌)", symbol:"☱", nature:"택(못/호수)", element:"금(金)" },
  "101": { key:"li",    name:"리(離)", symbol:"☲", nature:"불", element:"화(火)" },
  "100": { key:"zhen",  name:"진(震)", symbol:"☳", nature:"천둥", element:"목(木)" },
  "011": { key:"xun",   name:"손(巽)", symbol:"☴", nature:"바람", element:"목(木)" },
  "010": { key:"kan",   name:"감(坎)", symbol:"☵", nature:"물", element:"수(水)" },
  "001": { key:"gen",   name:"간(艮)", symbol:"☶", nature:"산", element:"토(土)" },
  "000": { key:"kun",   name:"곤(坤)", symbol:"☷", nature:"땅", element:"토(土)" },
};

// 숫자를 오행에 매핑(임의 규칙, 설명 생성용)
// 1:목 2:화 3:토 4:금 0:수
function numberElement(n){
  const r = n % 5;
  if (r === 1) return "목(木)";
  if (r === 2) return "화(火)";
  if (r === 3) return "토(土)";
  if (r === 4) return "금(金)";
  return "수(水)";
}

// 상생/상극 관계(간단 표기)
const GENERATES = { "목(木)":"화(火)", "화(火)":"토(土)", "토(土)":"금(金)", "금(金)":"수(水)", "수(水)":"목(木)" };
const OVERCOMES = { "목(木)":"토(土)", "토(土)":"수(水)", "수(水)":"화(火)", "화(火)":"금(金)", "금(金)":"목(木)" };

// ===== 해시 유틸 =====
async function sha256Bytes(str){
  if (crypto?.subtle?.digest) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return new Uint8Array(buf);
  }
  // 폴백: FNV-1a 32-bit를 반복해서 의사바이트 생성
  const bytes = new Uint8Array(32);
  let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  for (let i=0;i<32;i++){
    h ^= (i + 0x9e3779b9) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    bytes[i] = (h >>> ((i % 4) * 8)) & 0xff;
  }
  return bytes;
}

// ===== 주역(6효) 생성 =====
// lines[0] = 1효(맨 아래), lines[5] = 6효(맨 위)
function deriveLines(bytes){
  const lines = [];
  const moving = [];
  for (let i=0;i<6;i++){
    const b = bytes[i];
    const isYang = (b & 1) === 1;          // 음/양
    const isMoving = ((b >> 1) & 1) === 1; // 변효 여부
    lines.push(isYang ? 1 : 0);
    moving.push(isMoving);
  }
  // 변괘(지괘): 변효인 자리만 반전
  const changed = lines.map((v, idx) => moving[idx] ? (v ? 0 : 1) : v);
  return { lines, moving, changed };
}

function trigramFromLines(bottom3){
  // bottom3 is [line1,line2,line3] each 0/1
  const key = `${bottom3[0]}${bottom3[1]}${bottom3[2]}`;
  return TRIGRAMS[key] || null;
}

function dominantElement(upper, lower, moving){
  // 단순 규칙: 변효가 상괘(4~6효)에 더 많으면 상괘 오행, 아니면 하괘 오행
  const upperMoving = (moving[3]?1:0)+(moving[4]?1:0)+(moving[5]?1:0);
  const lowerMoving = (moving[0]?1:0)+(moving[1]?1:0)+(moving[2]?1:0);
  if (upper.element === lower.element) return upper.element;
  return (upperMoving >= lowerMoving) ? upper.element : lower.element;
}

// ===== 로또 번호 생성(1~45, 중복 제거) =====
function pickUniqueNumbers(bytes, count, offset){
  const out = [];
  let p = offset;
  // 충분히 뽑을 때까지(최악의 경우 대비해 안전장치)
  let guard = 0;
  while (out.length < count && guard < 4000){
    const hi = bytes[p % bytes.length];
    const lo = bytes[(p+1) % bytes.length];
    p += 2;
    const v = ((hi << 8) | lo) % 45 + 1;
    if (!out.includes(v)) out.push(v);
    guard++;
  }
  out.sort((a,b)=>a-b);
  return out;
}

// ===== UI 렌더 =====
function renderHex(targetEl, lines, moving){
  // 표시: 6효(위에서 아래로 보여주되, 라벨은 6효->1효)
  targetEl.innerHTML = "";
  for (let visualIdx = 5; visualIdx >= 0; visualIdx--){
    const eff = visualIdx + 1; // 효 번호
    const isYang = lines[visualIdx] === 1;
    const isMoving = moving ? !!moving[visualIdx] : false;

    const row = document.createElement("div");
    row.className = "lineRow";

    const lbl = document.createElement("div");
    lbl.className = "lineLabel";
    lbl.textContent = `${eff}효`;

    const bar = document.createElement("div");
    bar.className = "lineBar " + (isYang ? "yang" : "yin");

    if (isYang){
      const seg = document.createElement("div");
      seg.className = "seg";
      bar.appendChild(seg);
    } else {
      const seg1 = document.createElement("div");
      seg1.className = "seg";
      const seg2 = document.createElement("div");
      seg2.className = "seg";
      bar.appendChild(seg1);
      bar.appendChild(seg2);
    }

    const tag = document.createElement("div");
    tag.className = "movingTag";
    tag.textContent = isMoving ? "변효" : "고정";
    tag.style.visibility = isMoving ? "visible" : "hidden";

    row.appendChild(lbl);
    row.appendChild(bar);
    row.appendChild(tag);
    targetEl.appendChild(row);
  }
}

function getBallRange(n){
  if (n >= 1 && n <= 10) return "1";
  if (n >= 11 && n <= 20) return "2";
  if (n >= 21 && n <= 30) return "3";
  if (n >= 31 && n <= 40) return "4";
  return "5";
}

function applyBallInteractivity(el, candidates){
  if (!candidates || !candidates.length) return;
  el.dataset.candidates = JSON.stringify(candidates);
  el.dataset.candIndex = "0";
  el.style.cursor = "pointer";
  el.addEventListener("click", (e)=>{
    e.stopPropagation();
    const arr = JSON.parse(el.dataset.candidates || "[]");
    let idx = parseInt(el.dataset.candIndex || "0", 10);
    idx = (idx + 1) % arr.length;
    el.dataset.candIndex = String(idx);
    const v = arr[idx];
    el.textContent = v;
    el.setAttribute("data-range", getBallRange(v));
  });
}

function setBall(container, nums, cls, bytes){
  container.innerHTML = "";
  nums.forEach((n, idx)=>{
    const d = document.createElement("div");
    d.className = "ball " + (cls || "");
    d.setAttribute("data-range", getBallRange(n));
    d.style.animationDelay = (idx * 50) + "ms";
    d.textContent = n;

    // 후보 생성: 같은 오행(요소)을 우선적으로 모아 순환 가능하도록 함
    const candidates = buildAlternatives(bytes, n, 6);
    applyBallInteractivity(d, candidates.length ? [n].concat(candidates) : [n]);

    container.appendChild(d);
  });
}

function buildAlternatives(bytes, baseNum, maxCount){
  const out = [];
  const baseEl = numberElement(baseNum);
  let offset = 13;
  let tries = 0;
  while (out.length < maxCount && tries < 200){
    const candidates = pickUniqueNumbers(bytes, 10, offset);
    for (const c of candidates){
      if (c === baseNum) continue;
      if (numberElement(c) === baseEl && !out.includes(c)) out.push(c);
      if (out.length >= maxCount) break;
    }
    offset += 7;
    tries++;
  }
  // 폴백: 같은 오행이 충분치 않으면 다른 숫자 추가
  offset = 999;
  tries = 0;
  while (out.length < maxCount && tries < 100){
    const c = pickUniqueNumbers(bytes, 1, offset)[0];
    if (c !== baseNum && !out.includes(c)) out.push(c);
    offset++;
    tries++;
  }
  return out;
}

function buildReasons(mainNums, ctx){
  const { upper, lower, domEl, moving, lines } = ctx;
  const moveIdx = moving.map((m,i)=>m ? (i+1) : null).filter(Boolean); // 1~6효
  const moveText = moveIdx.length ? `${moveIdx.join(",")}효` : "없음";

  return mainNums.map((n, i) => {
    const el = numberElement(n);
    const linePos = (n % 6) === 0 ? 6 : (n % 6); // 1~6
    const isMoving = !!moving[linePos-1];
    const yinYang = lines[linePos-1] === 1 ? "양(—)" : "음(– –)";
    const trigram = linePos <= 3 ? lower : upper; // 1~3 하괘, 4~6 상괘
    const trigramLabel = trigram ? `${trigram.symbol} ${trigram.name}` : "-";

    // 상생/상극 관계를 스토리로 변환 (더 명확한 이유 제공)
    const gen = GENERATES[domEl];
    const over = OVERCOMES[domEl];

    let relationLabel = "별개의 성질";
    let relationText = `이 숫자는 ${domEl}과 특별한 직접 연관이 없습니다.`;
    if (el === domEl) {
      relationLabel = "핵심 에너지";
      relationText = `이 숫자는 당신의 중심 에너지(${domEl})와 동일합니다 — 본질적으로 가장 강하게 공명합니다.`;
    } else if (el === gen) {
      relationLabel = "상생(지원)";
      relationText = `${domEl} → ${gen} 관계입니다. 이 숫자는 당신의 중심 에너지가 자연스럽게 성장하거나 돕는 역할을 합니다.`;
    } else if (el === over) {
      relationLabel = "상극(제약)";
      relationText = `${domEl} ⊣ ${over} 관계입니다. 이 숫자는 균형을 잡아주거나 제약을 주는 역할이므로, 과도한 동력은 억제될 수 있습니다.`;
    }

    const moveNote = isMoving
      ? `⚡ 변화 포인트: ${linePos}효가 변하고 있습니다 — 이 자리에서 에너지가 전환 중입니다.`
      : `🌿 안정의 자리: ${linePos}효는 고정되어 있습니다 — 이 부분은 현재 안정적입니다.`;

    // 풍부한 HTML 반환 — generate()에서 그대로 innerHTML로 렌더링됩니다.
    // 간결한 이유 한 줄 추가: 숫자와 오행의 연결을 서술적으로 표현
    let reasonShort = '';
    if (el === domEl) reasonShort = '숫자의 오행이 중심 오행과 동일하여 강하게 공명합니다.';
    else if (el === gen) reasonShort = '중심 오행을 돕는 상생 관계로 자연스럽게 힘을 북돋아 줍니다.';
    else if (el === over) reasonShort = '중심을 제어하는 상극 관계로 균형을 잡아주거나 제약을 줍니다.';
    else reasonShort = '중심과 다른 오행으로 보완적이거나 변화를 촉발할 수 있습니다.';

    // 내부적으로는 다섯 갈래의 순환 위치를 사용하지만, 사용자에게는
    // 더 이해하기 쉬운 설명으로 보여줍니다 (수식 노출 없음).
    const posIndex = ((n - 1) % 5) + 1; // 내부 계산만 사용
    const ordinals = ["첫째", "둘째", "셋째", "넷째", "다섯째"];
    const positionDesc = ordinals[(posIndex - 1) % ordinals.length];
    const poetic = `${positionDesc} 자리에 놓인 숫자라, 전통적으로 이 자리는 ${el}의 성질을 띱니다.`.replace('띱니다', '닙니다');
    return `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <strong style="font-size:16px;color:#111;">${i+1}번: ${n}</strong>
          <span class="pill">요소: ${el}</span>
          <span class="pill">${yinYang}</span>
          <span class="pill">괘: ${trigramLabel}</span>
          <span class="movingTag" style="visibility:visible;">${isMoving ? '변효' : '고정'}</span>
        </div>
        <div style="color:#374151;font-size:14px;">${relationText}</div>
        <div style="color:#6b7280;font-size:13px;">${moveNote}</div>
        <div class="reasonShort">이유: ${poetic} ${reasonShort}</div>
      </div>
    `;
  });
}

async function generate(){
  const year = document.getElementById("birthYear").value;
  const month = document.getElementById("birthMonth").value;
  const day = document.getElementById("birthDay").value;
  const hour = document.getElementById("birthHour").value;
  const minute = document.getElementById("birthMinute").value;

  const errEl = document.getElementById("err");
  const msgEl = document.getElementById("msg");

  errEl.textContent = "";
  msgEl.textContent = "";

  if (!year || !month || !day){
    errEl.textContent = "생년월일은 필수입니다.";
    return;
  }

  const birthDate = `${year}-${month}-${day}`;
  const birthTime = (hour && minute) ? `${hour}:${minute}` : "";
  
  const seed = birthTime ? `${birthDate}T${birthTime}` : `${birthDate}`;
  msgEl.textContent = `씨드: ${seed} (결정론적 생성)`;

  // URL 반영 (공유/재현)
  const usp = new URLSearchParams(location.search);
  usp.set("d", birthDate);
  if (birthTime) usp.set("t", birthTime); else usp.delete("t");
  history.replaceState({}, "", `${location.pathname}?${usp.toString()}`);

  // 각 버튼 클릭마다 다른 결과를 만들기 위해 세션에 nonce(카운터)를 사용합니다.
  // 이 nonce를 seed에 합쳐 해시를 만들면, 같은 입력값이라도 버튼을 누를 때마다
  // 숫자/순서가 바뀝니다.
  let nonce = 0;
  try { nonce = Number(sessionStorage.getItem('generateNonce') || '0'); } catch(e) { nonce = 0; }
  nonce = (isNaN(nonce) ? 0 : nonce) + 1;
  try { sessionStorage.setItem('generateNonce', String(nonce)); } catch(e) {}
  const bytes = await sha256Bytes(seed + '|' + nonce);
  const { lines, moving, changed } = deriveLines(bytes);

  const lower = trigramFromLines([lines[0], lines[1], lines[2]]);
  const upper = trigramFromLines([lines[3], lines[4], lines[5]]);
  const domEl = dominantElement(upper, lower, moving);

  // 5세트 랜덤 생성
  // 5세트: 해시(bytes) 기반의 결정론적 생성(주역 정보 일부를 오프셋에 사용)
  const allSets = [];
  const moveCount = moving.reduce((s,v)=>s + (v?1:0), 0);
  for (let setIdx = 0; setIdx < 5; setIdx++){
    const offset = setIdx * 7 + moveCount;
    const nums = pickUniqueNumbers(bytes, 5, offset);
    allSets.push(nums);
  }

  // 각 세트에 보너스 번호 1개 추가 (본래 번호들과 중복되지 않게 선택)
  const bonuses = [];
  for (let setIdx = 0; setIdx < 5; setIdx++){
    let offsetB = 200 + setIdx * 3 + (bytes[(setIdx + 10) % bytes.length] || 0);
    let b = pickUniqueNumbers(bytes, 1, offsetB)[0];
    let guard = 0;
    while (allSets[setIdx].includes(b) && guard < 200){
      offsetB += 1;
      b = pickUniqueNumbers(bytes, 1, offsetB)[0];
      guard++;
    }
    bonuses.push(b);
  }

  // UI 표시
  document.getElementById("resultEmpty").style.display = "none";
  document.getElementById("result").style.display = "block";

  document.getElementById("pillSeed").textContent = `입력: ${seed}`;
  document.getElementById("pillUpper").textContent = `상괘: ${upper.symbol} ${upper.name} · ${upper.nature} · ${upper.element}`;
  document.getElementById("pillLower").textContent = `하괘: ${lower.symbol} ${lower.name} · ${lower.nature} · ${lower.element}`;
  document.getElementById("pillDominant").textContent = `중심 오행(규칙): ${domEl}`;

  // 5세트 표시
  const setsContainer = document.getElementById("allLottoSets");
  setsContainer.innerHTML = "";
      allSets.forEach((nums, idx) => {
    const setDiv = document.createElement("div");
    setDiv.style.cssText = "padding: 12px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05)); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.2);";
    
    const textDiv = document.createElement("div");
    textDiv.style.cssText = "font-weight: 700; font-size: 18px; color: #1f2937; margin-bottom: 10px;";
        textDiv.textContent = `${idx + 1}번: ${nums.join(" - ")}`;
        // 클릭하면 순서를 토글(오름/내림)
        textDiv.style.cursor = 'pointer';
    setDiv.appendChild(textDiv);
    
    const ballsDiv = document.createElement("div");
    ballsDiv.className = "nums";
        setBall(ballsDiv, nums, "", bytes);
    setDiv.appendChild(ballsDiv);

    // 보너스 표시 (작은 공)
    const bonusRow = document.createElement("div");
    bonusRow.style.cssText = "margin-top:8px; display:flex; gap:8px; align-items:center;";
    const bonusLabel = document.createElement("div");
    bonusLabel.style.cssText = "font-size:13px; color:#6b7280; font-weight:600;";
    bonusLabel.textContent = "보너스";
    const bonusBall = document.createElement("div");
    bonusBall.className = "ball small";
    bonusBall.setAttribute("data-range", getBallRange(bonuses[idx]));
    bonusBall.textContent = bonuses[idx];
    bonusRow.appendChild(bonusLabel);
    bonusRow.appendChild(bonusBall);
    setDiv.appendChild(bonusRow);
    
        // 토글 함수: 현재 표시 순서를 반전
        textDiv.addEventListener('click', ()=>{
          const current = Array.from(ballsDiv.querySelectorAll('.ball')).map(b=>parseInt(b.textContent,10));
          const reversed = current.slice().reverse();
          setBall(ballsDiv, reversed, "", bytes);
        });

        setsContainer.appendChild(setDiv);
  });

  renderHex(document.getElementById("hexOriginal"), lines, moving);
  // 지괘는 "변효" 정보를 그대로 보여주면 혼동되니, 라벨만 고정 표시
  renderHex(document.getElementById("hexChanged"), changed, moving);

  // 변효 설명을 본괘/변화괘 아래에 간략히 표시
  const origNote = document.getElementById("hexOriginalNote");
  const changedNote = document.getElementById("hexChangedNote");
  if (origNote) {
    origNote.textContent = "변효(變爻)는 현재 그 효에서 에너지가 변화 중임을 뜻합니다. 본괘는 지금의 상태를 보여주며, 변효는 그 자리에서 일시적 혹은 진행 중인 변화를 나타냅니다.";
  }
  if (changedNote) {
    changedNote.textContent = "변화괘는 변효가 반전된 모습을 보여줍니다. 변효가 있는 효는 향후의 전환점을 가리키며, 변화괘는 그 변화가 반영된 가능성의 방향을 제시합니다.";
  }

  const mainNums = allSets[0]; // 첫 번째 세트로 설명 표시
  const reasons = buildReasons(mainNums, { upper, lower, domEl, moving, lines });
  const ul = document.getElementById("reasons");
  ul.innerHTML = "";
      reasons.forEach(r=>{
        const li = document.createElement("li");
        // buildReasons가 HTML을 반환하므로 그대로 삽입
        li.innerHTML = r;
        ul.appendChild(li);
      });
}

// 드롭다운 초기화
function initializeDateSelects(){
  const yearSelect = document.getElementById("birthYear");
  const monthSelect = document.getElementById("birthMonth");
  const daySelect = document.getElementById("birthDay");
  const hourSelect = document.getElementById("birthHour");
  const minuteSelect = document.getElementById("birthMinute");

  // 년도: 1900~2050
  for (let y = 2050; y >= 1900; y--){
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }

  // 월: 1~12 (패딩: 01~12)
  for (let m = 1; m <= 12; m++){
    const opt = document.createElement("option");
    opt.value = String(m).padStart(2, "0");
    opt.textContent = `${m}월`;
    monthSelect.appendChild(opt);
  }

  // 일: 1~31 (패딩: 01~31)
  for (let d = 1; d <= 31; d++){
    const opt = document.createElement("option");
    opt.value = String(d).padStart(2, "0");
    opt.textContent = `${d}일`;
    daySelect.appendChild(opt);
  }

  // 시간: 0~23 (패딩: 00~23)
  for (let h = 0; h < 24; h++){
    const opt = document.createElement("option");
    opt.value = String(h).padStart(2, "0");
    opt.textContent = `${h.toString().padStart(2,"0")}시`;
    hourSelect.appendChild(opt);
  }

  // 분: 0, 30분 단위 (패딩: 00, 30)
  for (let m = 0; m < 60; m += 30){
    const opt = document.createElement("option");
    opt.value = String(m).padStart(2, "0");
    opt.textContent = `${m.toString().padStart(2,"0")}분`;
    minuteSelect.appendChild(opt);
  }
}

// yyyymmdd 빠른 입력 처리
function handleQuickDateInput(e){
  const input = e.target.value;
  const digitsOnly = input.replace(/[^0-9]/g, "");
  
  // 표시용 포매팅
  let display = "";
  if (digitsOnly.length > 0 && digitsOnly.length <= 4) {
    display = digitsOnly;
  } else if (digitsOnly.length > 4 && digitsOnly.length <= 6) {
    display = digitsOnly.substring(0, 4) + "-" + digitsOnly.substring(4);
  } else if (digitsOnly.length > 6) {
    display = digitsOnly.substring(0, 4) + "-" + digitsOnly.substring(4, 6) + "-" + digitsOnly.substring(6, 8);
  }
  e.target.value = display;
  
  // 정확히 8자리일 때만 처리
  if (digitsOnly.length === 8) {
    const year = digitsOnly.substring(0, 4);
    const month = digitsOnly.substring(4, 6);
    const day = digitsOnly.substring(6, 8);
    
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    
    // 유효성 검증
    if (y >= 1900 && y <= 2050 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      // 드롭다운 설정 (값이 패딩된 문자열이므로 패딩 상태로 설정)
      document.getElementById("birthYear").value = year;
      document.getElementById("birthMonth").value = month;
      document.getElementById("birthDay").value = day;
      
      // 3초 후 입력창 초기화
      setTimeout(() => {
        e.target.value = "";
      }, 3000);
    } else {
      // 유효하지 않은 날짜
      e.target.style.borderColor = "#ef4444";
      e.target.style.background = "#fef2f2";
      setTimeout(() => {
        e.target.style.borderColor = "#e5e7eb";
        e.target.style.background = "#f9fafb";
      }, 2000);
    }
  }
}

// 초기값(쿼리에서 복원)
function hydrateFromQuery(){
  const usp = new URLSearchParams(location.search);
  const d = usp.get("d");
  const t = usp.get("t");
  if (d){
    const parts = d.split("-");
    if (parts.length === 3){
      document.getElementById("birthYear").value = parts[0];
      document.getElementById("birthMonth").value = parts[1];
      document.getElementById("birthDay").value = parts[2];
    }
  }
  if (t){
    const parts = t.split(":");
    if (parts.length === 2){
      document.getElementById("birthHour").value = parts[0];
      document.getElementById("birthMinute").value = parts[1];
    }
  }
  if (d) generate();
}

// 초기화
initializeDateSelects();
document.getElementById("btn").addEventListener("click", generate);
document.getElementById("quickDateInput").addEventListener("input", handleQuickDateInput);
hydrateFromQuery();
