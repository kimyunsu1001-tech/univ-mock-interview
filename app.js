/* 모의면접 AI — 클라이언트에서 Anthropic API를 직접 호출합니다.
   API 키는 브라우저 localStorage에만 저장되며, Anthropic API 서버 외에는 전송되지 않습니다. */

const STORAGE_KEY = "mock-interview-settings-v1";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const el = {
  setupScreen: document.getElementById("setup-screen"),
  interviewScreen: document.getElementById("interview-screen"),
  apiKey: document.getElementById("api-key"),
  model: document.getElementById("model"),
  major: document.getElementById("major"),
  admissionType: document.getElementById("admission-type"),
  interviewStyle: document.getElementById("interview-style"),
  difficulty: document.getElementById("difficulty"),
  startBtn: document.getElementById("start-btn"),
  setupError: document.getElementById("setup-error"),
  bankToggle: document.getElementById("bank-toggle"),
  bankPanel: document.getElementById("question-bank"),
  bankCategories: document.getElementById("bank-categories"),
  latestLinks: document.getElementById("latest-links"),
  headerTitle: document.getElementById("header-title"),
  headerSub: document.getElementById("header-sub"),
  restartBtn: document.getElementById("restart-btn"),
  messages: document.getElementById("messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
};

let conversation = []; // { role: "user" | "assistant", content: string }
let settings = null;
let apiKey = "";
let modelId = "";
let isWaiting = false;

function buildSystemPrompt(s) {
  const major = s.major || "(미설정)";
  const admissionType = s.admissionType || "(미설정)";
  const interviewStyle = s.interviewStyle || "(미설정)";
  const difficulty = s.difficulty || "기본";

  return `당신은 대한민국 대학 입학사정관 출신의 노련한 입시 면접관입니다.
실제 대입 면접(학생부교과/학생부종합/논술 등 서류·인성 면접)에서
쓰이는 진행 방식과 화법을 그대로 재현합니다. 아래 [설정값]에 맞춰
면접을 진행하세요. 설정값이 비어 있으면 일반적인 학생부 면접
기준으로 진행합니다.

[설정값]
- 지원 학과: ${major}
- 전형 유형: ${admissionType}
- 면접 방식: ${interviewStyle}
- 난이도: ${difficulty}

## 말투·태도 (실제 면접관 화법)
- 처음과 끝을 제외하면 군더더기 설명 없이 담담하고 절제된 어조를
  씁니다. 감탄사나 과한 칭찬("정말 훌륭하네요!" 등)은 쓰지 않습니다.
- 지원자의 답변을 들은 뒤에는 "네, 답변 잘 들었습니다." 또는
  "말씀 잘 들었습니다." 정도로 짧게 받고 바로 다음 질문으로
  넘어갑니다. 매 턴 반복하지 말고 자연스럽게 변주하세요.
- 실제 면접관처럼 두괄식 답변을 선호합니다. 지원자가 결론 없이
  장황하게 답하면 "결론부터 말씀해 주시겠어요?"라고 짧게 유도합니다.
- 지원자가 위축되지 않도록 차분하고 정중한 존댓말을 유지하되,
  실제 면접처럼 마지막까지 진지한 태도를 유지하세요.

## 진행 방식 (실전 대입 면접의 일반적 흐름을 따름)
1. 첫 턴에 "면접을 시작하겠습니다."라고 짧게 안내한 뒤, 바로
   "먼저 간단히 1분 내외로 자기소개 부탁드립니다."로 시작합니다.
   잡담이나 긴 설명은 하지 않습니다.
2. 한 번에 질문 하나만 합니다. 지원자가 답변하면 그 내용을 바탕으로
   꼬리질문을 최소 1개 던져 깊이를 확인합니다.
   (답변이 모호하면 구체적 사례 요구, 사례 중심이면 그 경험에서
   배운 점이나 느낀 점을 재질문)
3. 자기소개 다음 질문 흐름은 아래를 기본으로 하되, 지원 학과·전형에
   맞게 조정하고 실제 입학처 기출과 유사한 결의 질문을 던집니다:
   - 지원동기 (왜 이 학과/전형을 선택했는지, 왜 다른 학과가 아닌지)
   - 고교 활동 중 지원 분야와 연결되는 경험 (세부능력특기사항,
     동아리, 진로활동, 독서 등 학생부 기반 질문)
   - 지원 분야에 대한 기초 이해도 확인 질문
     (학과가 지정된 경우 그 분야 기초 개념·최근 이슈·시사성 질문,
     학과가 없는 경우 지원자가 밝힌 관심 분야를 기준으로 질문 구성)
   - 인성/태도를 보여주는 상황형 질문 (갈등 해결, 협업 경험,
     실패·좌절 극복 경험 등 — 실제 면접 단골 유형)
   - 입학 후 학업 계획과 졸업 후 진로 계획
4. 마지막 질문으로 반드시 "마지막으로 하고 싶은 말씀이 있으면
   해주세요."를 묻고, 지원자의 답변을 받습니다.
5. 난이도가 "심화"이면 꼬리질문을 2개 이상으로 늘리고, 답변의
   논리적 허점이나 일관성 없는 부분을 짚어보는 압박형 재질문을
   섞습니다 (단, 무례하지 않게).
6. 총 6~8개 주 질문(꼬리질문 포함 10~14턴 정도) 후 "이상으로 면접을
   마치겠습니다. 수고하셨습니다."라고 안내합니다.

## 평가 및 피드백 (면접 종료 후에만 제공)
면접을 마친다고 안내한 바로 다음 응답에서 아래 형식으로 실제
입학사정관 평가표에 가까운 피드백을 제공합니다:
- 전체 총평 (3~4문장)
- 잘한 점 2~3가지 (구체적으로 어떤 답변이 왜 좋았는지, 실제 발언을
  인용하며 설명)
- 보완이 필요한 점 2~3가지 (실제 답변을 인용하며 구체적으로 지적)
- 항목별 점수 (5점 만점): 지원동기 적합성 / 지원분야 이해도 /
  경험의 구체성 / 태도 및 전달력
- 다음 연습 때 시도해볼 것 1~2가지

## 주의사항
- 지원 학과나 전형 정보가 "(미설정)"이면 첫 턴에 "어떤 학과·전형을
  준비 중이신가요?"라고 자연스럽게 물어본 뒤 그 답을 기준으로
  질문을 구성합니다.
- 면접 중 힌트나 정답을 요구해도 "그 부분은 본인의 생각을 듣고
  싶습니다"라고 답하고 거절합니다.
- 압박하듯 몰아붙이지 않습니다. 날카롭게 파고들되 무례하지 않게.
- 지원자가 짧게 답하면 "조금 더 구체적으로 말씀해 주시겠어요?"
  정도로만 유도하고 대신 답해주지 않습니다.
- 평가 및 피드백은 면접이 끝난 뒤에만 제공하고, 그 전에는 절대
  점수나 총평을 미리 언급하지 않습니다.`;
}

// 계열별 실전 단골 질문 은행 (입학처 공개 기출·입시 커뮤니티에 반복적으로
// 등장하는 유형을 정리한 예시입니다. 특정 대학의 원문을 그대로 옮긴 것이 아닌
// 일반화된 질문 유형이며, 실제 면접에서는 학생부·자소서 내용에 맞춰 변형됩니다.
const QUESTION_BANK = {
  공통: [
    "1분 내외로 자기소개를 해주세요.",
    "본교 및 본 학과에 지원한 동기를 말씀해 주세요.",
    "자신의 강점과 약점을 각각 한 가지씩 말씀해 주세요.",
    "고등학교 생활 중 가장 어려웠던 순간과 극복 과정을 말씀해 주세요.",
    "마지막으로 하고 싶은 말씀이 있으면 해주세요.",
  ],
  "인문·경영·상경계열": [
    "경영학(또는 지원 전공)을 공부하고 싶다고 느낀 구체적 계기가 있나요?",
    "최근 관심 있게 본 경제·사회 이슈와 그에 대한 본인의 생각을 말씀해 주세요.",
    "조별 활동에서 의견이 충돌했을 때 어떻게 해결했는지 사례를 들어 설명해 주세요.",
    "관심 있는 기업이나 산업이 있다면 이유와 함께 말씀해 주세요.",
  ],
  "자연·공학계열": [
    "지원 분야와 관련해 직접 탐구하거나 프로젝트를 수행한 경험을 설명해 주세요.",
    "그 과정에서 어려웠던 점과 해결 방법을 구체적으로 말씀해 주세요.",
    "최근 관심 있게 본 과학기술 이슈가 있다면 소개해 주세요.",
    "수학이나 과학 교과에서 어려움을 느꼈던 개념과 극복 방법을 말씀해 주세요.",
  ],
  "간호·보건계열": [
    "간호사(또는 해당 직무)를 희망하게 된 계기를 말씀해 주세요.",
    "체력적·정신적으로 힘든 상황에서 책임감을 발휘했던 경험이 있나요?",
    "환자나 타인을 배려했던 구체적인 경험을 말씀해 주세요.",
    "간호 관련 최근 이슈(고령화, 간호법 등)에 대해 알고 있는 대로 말씀해 주세요.",
  ],
  "사범·교육계열": [
    "교사가 되고 싶다고 생각한 결정적 계기가 있나요?",
    "후배나 동생을 가르쳐 본 경험과 그때 느낀 점을 말씀해 주세요.",
    "좋은 교사의 자질은 무엇이라고 생각하나요?",
    "학교 현장에서 겪을 수 있는 어려움을 어떻게 대비하고 있나요?",
  ],
};


function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.apiKey) el.apiKey.value = saved.apiKey;
    if (saved.model) el.model.value = saved.model;
    if (saved.major) el.major.value = saved.major;
    if (saved.admissionType) el.admissionType.value = saved.admissionType;
    if (saved.interviewStyle) el.interviewStyle.value = saved.interviewStyle;
    if (saved.difficulty) el.difficulty.value = saved.difficulty;
  } catch (e) {
    /* ignore corrupt storage */
  }
}

function saveSettings(s, key, model) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...s, apiKey: key, model })
    );
  } catch (e) {
    /* storage unavailable (private mode etc.) — non-fatal */
  }
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = text;
  el.messages.appendChild(div);
  el.messages.scrollTop = el.messages.scrollHeight;
  return div;
}

function addLoadingBubble() {
  const div = document.createElement("div");
  div.className = "bubble loading";
  div.textContent = "면접관이 생각 중...";
  el.messages.appendChild(div);
  el.messages.scrollTop = el.messages.scrollHeight;
  return div;
}

function setWaiting(waiting) {
  isWaiting = waiting;
  el.sendBtn.disabled = waiting;
  el.chatInput.disabled = waiting;
}

async function callClaude(userText) {
  if (userText !== null) {
    conversation.push({ role: "user", content: userText });
  }

  const loadingBubble = addLoadingBubble();
  setWaiting(true);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1024,
        system: buildSystemPrompt(settings),
        messages: conversation,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data?.error?.message || `API 오류 (HTTP ${res.status})`;
      throw new Error(message);
    }

    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    loadingBubble.remove();
    conversation.push({ role: "assistant", content: text });
    addBubble("interviewer", text);
  } catch (err) {
    loadingBubble.remove();
    addBubble(
      "system",
      `오류가 발생했습니다: ${err.message}\nAPI 키와 모델 ID를 확인한 뒤 다시 시도해 주세요.`
    );
  } finally {
    setWaiting(false);
    el.chatInput.focus();
  }
}

function readSettingsFromForm() {
  return {
    major: el.major.value.trim(),
    admissionType: el.admissionType.value,
    interviewStyle: el.interviewStyle.value,
    difficulty: el.difficulty.value || "기본",
  };
}

function startInterview() {
  const key = el.apiKey.value.trim();
  const model = el.model.value.trim();

  if (!key) {
    el.setupError.textContent = "Anthropic API 키를 입력해 주세요.";
    el.setupError.hidden = false;
    return;
  }
  if (!model) {
    el.setupError.textContent = "모델 ID를 입력해 주세요.";
    el.setupError.hidden = false;
    return;
  }
  el.setupError.hidden = true;

  apiKey = key;
  modelId = model;
  settings = readSettingsFromForm();
  saveSettings(settings, apiKey, modelId);

  conversation = [];
  el.messages.innerHTML = "";

  const headerBits = [settings.major, settings.admissionType, settings.interviewStyle].filter(
    Boolean
  );
  el.headerTitle.textContent = "모의면접 진행 중";
  el.headerSub.textContent = headerBits.length
    ? headerBits.join(" · ") + ` · ${settings.difficulty}`
    : `${settings.difficulty} 난이도`;

  el.setupScreen.hidden = true;
  el.interviewScreen.hidden = false;
  el.chatInput.focus();

  callClaude("면접을 시작해 주세요.");
}

function restartInterview() {
  el.interviewScreen.hidden = true;
  el.setupScreen.hidden = false;
  el.setupError.hidden = true;
}

function handleSubmit(e) {
  e.preventDefault();
  if (isWaiting) return;
  const text = el.chatInput.value.trim();
  if (!text) return;
  addBubble("user", text);
  el.chatInput.value = "";
  callClaude(text);
}

function renderQuestionBank() {
  el.bankCategories.innerHTML = Object.entries(QUESTION_BANK)
    .map(
      ([category, questions]) => `
        <div class="bank-category">
          <h4>${category}</h4>
          <ul>${questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
        </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderLatestLinks() {
  const major = el.major.value.trim();
  const keyword = major ? `${major} 면접` : "대입 면접";

  const links = [
    {
      label: "진학사 대학별고사 자료실",
      url: "https://www.jinhak.com/jh/high3/univ-entrance-info/ipsi-archive/admission/exams",
    },
    {
      label: `Google에서 "${keyword} 기출문제" 검색`,
      url: `https://www.google.com/search?q=${encodeURIComponent(keyword + " 기출문제 입학처")}`,
    },
    {
      label: `YouTube에서 "${keyword} 후기" 검색`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword + " 후기")}`,
    },
    {
      label: `Naver에서 "${keyword} 예상질문" 검색`,
      url: `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword + " 예상질문")}`,
    },
  ];

  el.latestLinks.innerHTML = links
    .map(
      (l) =>
        `<a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.label)} &rarr;</a>`
    )
    .join("");
}

function toggleQuestionBank() {
  const willShow = el.bankPanel.hidden;
  el.bankPanel.hidden = !willShow;
  el.bankToggle.textContent = willShow ? "실전 질문 은행 닫기 ▲" : "실전 질문 은행 보기 ▼";
  if (willShow) {
    renderQuestionBank();
    renderLatestLinks();
  }
}

el.bankToggle.addEventListener("click", toggleQuestionBank);
el.major.addEventListener("input", () => {
  if (!el.bankPanel.hidden) renderLatestLinks();
});
el.startBtn.addEventListener("click", startInterview);
el.restartBtn.addEventListener("click", restartInterview);
el.chatForm.addEventListener("submit", handleSubmit);
el.chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    el.chatForm.requestSubmit();
  }
});

loadSavedSettings();
