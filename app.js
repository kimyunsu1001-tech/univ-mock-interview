/* 모의 면접 AI — 클라이언트에서 Anthropic API를 직접 호출합니다.
   API 키는 브라우저 localStorage에만 저장되며, Anthropic API 서버 외에는 전송되지 않습니다. */

const STORAGE_KEY = "mock-interview-settings-v1";
const HISTORY_KEY = "mock-interview-history-v1";
const MAX_HISTORY = 10;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const PROXY_URL = "https://mock-interview-proxy.kimyunsu1001.workers.dev";
const FREE_MODEL_LABEL = "무료 체험 모델";
const WARNING_MARKER = "⚠️ 답변 확인:";

const el = {
  topNav: document.getElementById("top-nav"),
  heroSection: document.getElementById("hero-section"),
  featuresSection: document.getElementById("features-section"),
  setupScreen: document.getElementById("setup-screen"),
  interviewScreen: document.getElementById("interview-screen"),
  modeFreeBtn: document.getElementById("mode-free-btn"),
  modeOwnBtn: document.getElementById("mode-own-btn"),
  modeDesc: document.getElementById("mode-desc"),
  apiKeySection: document.getElementById("api-key-section"),
  apiKey: document.getElementById("api-key"),
  model: document.getElementById("model"),
  major: document.getElementById("major"),
  admissionType: document.getElementById("admission-type"),
  interviewStyle: document.getElementById("interview-style"),
  difficulty: document.getElementById("difficulty"),
  personalInfo: document.getElementById("personal-info"),
  personalInfoFile: document.getElementById("personal-info-file"),
  fileUploadStatus: document.getElementById("file-upload-status"),
  startBtn: document.getElementById("start-btn"),
  setupError: document.getElementById("setup-error"),
  bankToggle: document.getElementById("bank-toggle"),
  bankPanel: document.getElementById("question-bank"),
  bankCategories: document.getElementById("bank-categories"),
  latestLinks: document.getElementById("latest-links"),
  historyToggle: document.getElementById("history-toggle"),
  historyPanel: document.getElementById("history-panel"),
  historyList: document.getElementById("history-list"),
  headerTitle: document.getElementById("header-title"),
  headerSub: document.getElementById("header-sub"),
  chatTimer: document.getElementById("chat-timer"),
  progressFill: document.getElementById("progress-fill"),
  copyBtn: document.getElementById("copy-btn"),
  micBtn: document.getElementById("mic-btn"),
  voiceModeField: document.getElementById("voice-mode-field"),
  voiceModeCheckbox: document.getElementById("voice-mode-checkbox"),
  voiceModeBtn: document.getElementById("voice-mode-btn"),
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
let mode = "free"; // "free" | "own"
let voiceMode = false;
let isWaiting = false;
let turnCount = 0;
let interviewFinished = false;
let timerInterval = null;
let startTime = 0;

function buildSystemPrompt(s, opts) {
  // selfWarn: 무료 체험(free) 경로는 답변 적절성 판정을 서버(worker.js)의
  // 별도 결정적 호출로 처리하고 경고 줄도 서버가 직접 붙이므로, 소형
  // 모델이 시스템 프롬프트의 이 지시까지 얼떨결에 따라 하며 경고를
  // 중복 생성하는 것을 막기 위해 selfWarn=false로 이 지시 자체를 뺀다.
  // 본인 API 키(own) 경로는 서버 개입이 없으므로 기본값(true)을 쓴다.
  const selfWarn = !opts || opts.selfWarn !== false;
  const major = s.major || "(미설정)";
  const admissionType = s.admissionType || "(미설정)";
  const interviewStyle = s.interviewStyle || "(미설정)";
  const difficulty = s.difficulty || "기본";
  const personalInfoBlock = s.personalInfo
    ? `\n[지원자가 제공한 자기소개서·학생부 핵심 내용]\n${s.personalInfo}\n이 내용을 최우선으로 참고해 지원동기·활동 경험 질문을 이 내용에 맞춰 구체적으로 구성하세요. 지어내지 말고 위에 적힌 내용을 바탕으로만 질문하세요.\n`
    : "";

  const presentationBlock =
    interviewStyle === "제시문면접"
      ? `\n## 제시문 준비 (면접 방식이 "제시문면접"일 때)
자기소개 질문 다음, 본격 질문에 들어가기 전에 반드시 아래 형식으로
제시문을 먼저 제공하세요:
1. 지원 학과·계열과 연관된 사회·인문·과학 주제로 3~5문장 분량의
   짧은 제시문을 당신이 직접 작성합니다 (실제 대학 기출 원문을
   그대로 베끼지 말고, 그 결과 형식만 참고해 매번 새로 창작하세요).
   서울대·연세대·고려대 제시문 면접처럼 하나의 개념을 두 가지
   상반된 시각에서 제시하거나, 특정 사회적 딜레마를 던지는
   방식을 사용하세요.
2. "다음 제시문을 읽고 답변해 주세요"라고 안내한 뒤 제시문을
   보여주고, "이 제시문에서 다루는 핵심 쟁점은 무엇이라고
   생각하십니까?" 같은 분석형 질문을 던집니다.
3. 지원자의 제시문 분석 답변에 대해 2개 이상의 심화 꼬리질문으로
   논리적 근거를 계속 캐묻습니다 (실제 상위권 대학 구술고사
   방식). 이후에는 기존 학생부·지원동기 질문 흐름으로 넘어갑니다.
`
      : "";

  const warningBlock = selfWarn
    ? `
## 답변 적절성 확인 (경고)
지원자의 답변이 아래 중 하나에 명백히 해당할 때만, 응답 맨 첫 줄에
"${WARNING_MARKER} "로 시작하는 한 줄짜리 경고를 추가한 뒤 그 다음
줄부터 평소처럼 답합니다:
- 질문의 의도와 명백히 다른 내용으로 답했을 때 (질문과 무관한 화제)
- 질문에 사실상 답하지 않고 회피했을 때
- "네", "모르겠습니다"처럼 지나치게 짧고 성의 없는 답변일 때
- 이전 답변과 명백히 모순되는 내용을 말했을 때
- 반말, 욕설 등 면접 태도에 맞지 않는 표현을 썼을 때
경고 문구는 비난조가 아니라 담담한 사실 확인 어조로, 이유를 한 문장
으로 구체적으로 씁니다 (예: "${WARNING_MARKER} 방금 답변은 지원동기가
아니라 취미 이야기로 흘렀습니다."). 위 조건에 해당하지 않는 정상적인
답변에는 이 경고를 절대 붙이지 마세요. 남발하면 안 됩니다.
**이 경고를 붙인 턴에는 새로운 질문(꼬리질문 포함)을 절대 하지
마세요.** 대신 경고 문구 다음 줄에 "방금 드린 질문에 다시 답변해
주시겠어요?"처럼 같은 질문에 다시 답하도록 정중히 요청만 하세요.
`
    : "";

  return `당신은 서울 소재 상위권 대학 입학사정관 출신의, 수백 명을
면접해 온 베테랑 입시 면접관입니다. 실제 대입 면접(학생부교과/
학생부종합/논술 등 서류·인성·제시문 면접)에서 쓰이는 진행 방식과
화법을 정교하게 재현합니다. 아래 [설정값]에 맞춰 면접을 진행하세요.
설정값이 비어 있으면 일반적인 학생부 면접 기준으로 진행합니다.

[설정값]
- 지원 학과: ${major}
- 전형 유형: ${admissionType}
- 면접 방식: ${interviewStyle}
- 난이도: ${difficulty}
${personalInfoBlock}
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

## 실전 면접관의 질문 기법 (실제 입학사정관들이 쓰는 방식)
- **사실확인형 질문**: 지원자가 제공한 자기소개서·학생부 내용 중
  구체적인 활동명, 진로 변경 이력, 특정 기록을 정확히 짚어
  "그 활동을 하게 된 계기가 무엇인가요", "진로가 바뀐 이유는
  무엇인가요"처럼 근거를 캐묻습니다. 막연한 일반론으로 넘어가려는
  답변은 그냥 넘기지 않습니다.
- **꼬리질문은 두 종류를 섞어 씁니다**: (1) 반복확인형 — 방금 답변의
  핵심을 다른 각도에서 다시 확인하는 질문, (2) 심화탐구형 — 답변에서
  한 걸음 더 들어가 "왜 그렇게 생각했는지", "다른 방법은 없었는지"를
  파고드는 질문. 같은 유형만 반복하지 않습니다.
- 지원자가 활동의 결과만 말하면 과정과 사고 과정을, 과정만 말하면
  결과와 배운 점을 되묻습니다.

${warningBlock}${presentationBlock}
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
5. 난이도가 "심화"이면: (a) 꼬리질문을 2개 이상으로 늘리고,
   (b) 답변 속 논리적 허점이나 앞뒤가 다른 부분을 정확히 짚어
   "방금 답변은 아까 말씀하신 것과 다른 것 같은데, 다시 설명해
   주시겠어요?"처럼 재질문하며, (c) "그 방법이 최선이었다고
   생각하십니까?"처럼 지원자의 판단 자체에 이의를 제기하는 압박형
   질문을 최소 1회 포함합니다 (무례하지 않게, 논리로만 압박).
6. 총 6~8개 주 질문(꼬리질문 포함 10~14턴 정도) 후 "이상으로 면접을
   마치겠습니다. 수고하셨습니다."라고 안내합니다.

## 평가 및 피드백 (면접 종료 후에만 제공)
면접을 마친다고 안내한 바로 다음 응답에서 아래 6개 항목을 이 순서
그대로, 대괄호 제목([ ])을 그대로 출력하며 하나도 빠뜨리지 말고 모두
작성합니다. 점수는 무조건 높게 주지 말고, 실제 답변 수준에 맞춰
냉정하고 구체적으로 판단합니다:
[전체 총평] 2~3문장
[총점] XX점 / 100점 — 왜 그 점수인지 근거를 1~2문장으로 밝힙니다
(모호하게 "잘했습니다" 식으로 넘어가지 말고, 감점·가점 요인을
구체적으로 짚습니다)
[강점] 2가지 이상 (구체적으로 어떤 답변이 왜 좋았는지, 실제 발언을
인용하며 설명)
[단점] 2가지 이상 (실제 답변을 인용하며 구체적으로 지적, 두루뭉술하게
넘어가지 않습니다)
[항목별 점수] (5점 만점) 지원동기 적합성 / 지원분야 이해도 /
경험의 구체성 / 태도 및 전달력
[다음 연습] 시도해볼 것 1~2가지
**[강점]과 [단점]은 절대 생략하지 마세요.** 이 두 항목을 빠뜨리면
지원자에게 실질적인 도움이 되지 않습니다.

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

// 계열별 실전 단골 질문 은행. 대학 입학처가 매년 공개하는 "선행학습 영향평가
// 보고서"(기출문제·예시답안 수록, 서울대·고려대 등 공식 발간)와 입시 정보
// 사이트에 반복적으로 등장하는 유형을 정리한 예시입니다. 특정 연도·대학의
// 원문을 그대로 옮긴 것이 아닌 일반화된 질문 유형이며, 실제 면접에서는
// 학생부·자소서 내용에 맞춰 변형됩니다.
const QUESTION_BANK = {
  공통: [
    "1분 내외로 자기소개를 해주세요.",
    "본교 및 본 학과에 지원한 동기를 말씀해 주세요.",
    "자신의 강점과 약점을 각각 한 가지씩 말씀해 주세요.",
    "고등학교 생활 중 가장 어려웠던 순간과 극복 과정을 말씀해 주세요.",
    "생활기록부에 적힌 진로 희망이 바뀐 시점이 있다면, 그 배경을 설명해 주세요.",
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
  "최상위권(제시문면접) 실전 경향": [
    "짧은 제시문 두 개를 주고 같은 개념(예: 권위, 자유, 공정)을 서로 다른 관점에서 비교·분석하라는 유형 — 서울대·연세대 구술고사에서 자주 등장합니다.",
    "AI·기술이 인간의 판단을 대신할 때 생기는 문제처럼, 정답이 없는 사회적 딜레마에 대해 본인의 입장과 근거를 논리적으로 전개하라는 유형입니다.",
    "제시문의 핵심 주장을 요약한 뒤, 그 주장의 한계나 반론을 스스로 제기해 보라는 후속 질문이 이어지는 경우가 많습니다.",
    "준비 시간(인문 약 30분, 자연 약 45분 등 대학마다 상이) 동안 메모한 내용을 보며 답해도 되지만, 면접관은 메모를 그대로 읽는지 이해하고 말하는지를 꼼꼼히 봅니다.",
  ],
};

function setMode(next) {
  mode = next;
  el.modeFreeBtn.classList.toggle("active", mode === "free");
  el.modeOwnBtn.classList.toggle("active", mode === "own");
  el.apiKeySection.hidden = mode !== "own";
  el.modeDesc.textContent =
    mode === "free"
      ? "하루 30회까지 API 키 없이 무료로 체험할 수 있어요 (경량 모델 사용, 매일 초기화). 더 높은 품질과 무제한 사용을 원하면 본인 API 키를 입력하세요."
      : "본인의 Anthropic API 키로 Claude와 무제한으로 연습합니다. 키는 브라우저에만 저장되고 Anthropic API로만 전송됩니다.";
}

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
    if (saved.personalInfo) el.personalInfo.value = saved.personalInfo;
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
  if (role === "system") {
    const div = document.createElement("div");
    div.className = "bubble system";
    div.textContent = text;
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;
    return div;
  }

  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "🙋" : "🎓";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  el.messages.appendChild(row);
  el.messages.scrollTop = el.messages.scrollHeight;
  return row;
}

function addWarningBubble(message) {
  const div = document.createElement("div");
  div.className = "bubble warning";
  const icon = document.createElement("span");
  icon.className = "warning-icon";
  icon.textContent = "⚠️";
  const text = document.createElement("span");
  text.textContent = message;
  div.appendChild(icon);
  div.appendChild(text);
  el.messages.appendChild(div);
  el.messages.scrollTop = el.messages.scrollHeight;
  return div;
}

// AI 응답 맨 앞에 붙는 "⚠️ 답변 확인: ..." 한 줄을 분리해 별도의 경고
// 말풍선으로 렌더링하기 위한 파서. 마커가 없으면 원문 그대로 반환한다.
function splitWarning(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(WARNING_MARKER)) return { warning: null, rest: text };
  const newlineIdx = trimmed.indexOf("\n");
  const firstLine = newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx);
  const rest = newlineIdx === -1 ? "" : trimmed.slice(newlineIdx + 1).trimStart();
  const warning = firstLine.slice(WARNING_MARKER.length).trim();
  return { warning: warning || "답변이 질문 의도와 다소 다른 것 같습니다.", rest };
}

function addLoadingBubble() {
  const row = document.createElement("div");
  row.className = "msg-row interviewer";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "🎓";

  const bubble = document.createElement("div");
  bubble.className = "bubble loading";
  bubble.textContent = "면접관이 생각 중...";

  row.appendChild(avatar);
  row.appendChild(bubble);
  el.messages.appendChild(row);
  el.messages.scrollTop = el.messages.scrollHeight;
  return row;
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
    const url = mode === "free" ? PROXY_URL : ANTHROPIC_API_URL;
    const headers =
      mode === "free"
        ? { "content-type": "application/json" }
        : {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          };
    const requestBody =
      mode === "free"
        ? {
            system: buildSystemPrompt(settings, { selfWarn: false }),
            messages: conversation,
          }
        : {
            model: modelId,
            max_tokens: 1024,
            system: buildSystemPrompt(settings),
            messages: conversation,
          };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    if (!res.ok) {
      if (mode === "free" && res.status === 429) {
        loadingBubble.remove();
        conversation.pop(); // 실패한 요청의 사용자 메시지는 대화 기록에서 제거
        addBubble(
          "system",
          `${data?.error?.message || "오늘의 무료 체험 횟수를 모두 사용했습니다."}\n"새 면접" 버튼을 눌러 "내 API 키 사용" 모드로 전환하면 계속 이용할 수 있습니다.`
        );
        return;
      }
      const message = data?.error?.message || `요청 오류 (HTTP ${res.status})`;
      throw new Error(message);
    }

    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    loadingBubble.remove();
    conversation.push({ role: "assistant", content: text });

    const { warning, rest } = splitWarning(text);
    const displayText = warning ? rest : text;
    if (warning) addWarningBubble(warning);
    addBubble("interviewer", displayText);
    if (voiceMode) speak(warning ? `${warning}. ${displayText}` : displayText);

    if (!interviewFinished && (displayText.includes("총평") || displayText.includes("항목별 점수"))) {
      finishInterview();
    }
  } catch (err) {
    loadingBubble.remove();
    const hint =
      mode === "free"
        ? "잠시 후 다시 시도해 주세요. 계속 실패하면 '내 API 키 사용' 모드로 전환해 보세요."
        : "API 키와 모델 ID를 확인한 뒤 다시 시도해 주세요.";
    addBubble("system", `오류가 발생했습니다: ${err.message}\n${hint}`);
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
    personalInfo: el.personalInfo.value.trim(),
  };
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  startTime = Date.now();
  el.chatTimer.textContent = "⏱ 00:00";
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    el.chatTimer.textContent = `⏱ ${formatElapsed(Date.now() - startTime)}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateProgress() {
  const EXPECTED_TURNS = 12;
  const pct = Math.min((turnCount / EXPECTED_TURNS) * 100, interviewFinished ? 100 : 96);
  el.progressFill.style.width = `${pct}%`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch (e) {
    /* storage unavailable — non-fatal */
  }
}

function buildTranscriptText() {
  const headerBits = [settings.major, settings.admissionType, settings.interviewStyle, settings.difficulty]
    .filter(Boolean)
    .join(" · ");
  const lines = [`[모의 면접 AI] ${headerBits}`, ""];
  conversation.forEach((m) => {
    if (m.role === "user" && m.content === "면접을 시작해 주세요.") return;
    lines.push(`${m.role === "user" ? "지원자" : "면접관"}: ${m.content}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

function finishInterview() {
  interviewFinished = true;
  stopTimer();
  updateProgress();

  const entry = {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    major: settings.major,
    admissionType: settings.admissionType,
    difficulty: settings.difficulty,
    transcript: buildTranscriptText(),
  };
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list);

  if (el.historyToggle) el.historyToggle.hidden = false;
}

async function copyTranscript() {
  const text = buildTranscriptText();
  try {
    await navigator.clipboard.writeText(text);
    flashCopyButton();
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      flashCopyButton();
    } catch (e2) {
      addBubble("system", "복사에 실패했습니다. 직접 선택해서 복사해 주세요.");
    }
    document.body.removeChild(ta);
  }
}

function flashCopyButton() {
  const original = el.copyBtn.textContent;
  el.copyBtn.textContent = "복사됨 ✓";
  setTimeout(() => {
    el.copyBtn.textContent = original;
  }, 1500);
}

/* ---- 음성 입력/출력 (Web Speech API) ----
   음성 면접 모드에서는 면접관 질문을 음성으로 읽어주고(TTS), 답변도
   음성으로 받아(STT) 자동 전송함으로써 실제 대면 면접과 유사한 흐름을
   재현한다. autoCaptureActive는 시스템이 자동으로 시작한 녹음인지
   (자동 전송 대상) 사용자가 마이크 버튼을 직접 눌러 시작한 수동 입력인지
   (텍스트만 채우고 직접 전송 버튼을 누르게 함) 구분하기 위한 플래그다. */
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let isRecording = false;
let autoCaptureActive = false;

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ko-KR";
  utter.rate = 1.0;
  utter.pitch = 1.0;
  const koVoice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith("ko"));
  if (koVoice) utter.voice = koVoice;
  utter.onend = () => {
    if (voiceMode && !interviewFinished && !isWaiting) startVoiceCapture();
  };
  window.speechSynthesis.speak(utter);
}

function startVoiceCapture() {
  if (!recognizer || isRecording || isWaiting) return;
  autoCaptureActive = true;
  try {
    recognizer.start();
    isRecording = true;
    el.micBtn.classList.add("recording");
  } catch (e) {
    autoCaptureActive = false;
  }
}

function setVoiceMode(next) {
  voiceMode = next;
  try {
    localStorage.setItem("mock-interview-voice-mode", voiceMode ? "1" : "0");
  } catch (e) {
    /* storage unavailable — non-fatal */
  }
  if (el.voiceModeCheckbox) el.voiceModeCheckbox.checked = voiceMode;
  if (el.voiceModeBtn) el.voiceModeBtn.classList.toggle("active", voiceMode);
  if (!voiceMode) {
    window.speechSynthesis?.cancel();
    if (isRecording) recognizer?.stop();
  } else {
    const last = conversation[conversation.length - 1];
    if (last && last.role === "assistant" && !isWaiting && !interviewFinished) {
      speak(last.content);
    }
  }
}

function setupSpeechInput() {
  if (SpeechRecognitionImpl && el.micBtn) {
    el.micBtn.hidden = false;

    recognizer = new SpeechRecognitionImpl();
    recognizer.lang = "ko-KR";
    recognizer.continuous = false;
    recognizer.interimResults = false;

    recognizer.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      if (autoCaptureActive) {
        el.chatInput.value = transcript;
      } else {
        const prefix = el.chatInput.value.trim();
        el.chatInput.value = prefix ? `${prefix} ${transcript}` : transcript;
      }
    };

    recognizer.onend = () => {
      isRecording = false;
      el.micBtn.classList.remove("recording");
      if (autoCaptureActive) {
        autoCaptureActive = false;
        const text = el.chatInput.value.trim();
        if (text) {
          el.chatForm.requestSubmit();
        } else if (voiceMode) {
          addBubble("system", "음성이 인식되지 않았어요. 마이크 버튼을 눌러 다시 답변해 주세요.");
        }
      }
    };

    recognizer.onerror = (event) => {
      isRecording = false;
      el.micBtn.classList.remove("recording");
      if (autoCaptureActive) {
        autoCaptureActive = false;
        if (voiceMode) {
          addBubble(
            "system",
            `음성 인식에 실패했습니다 (${event.error || "오류"}). 마이크 버튼을 눌러 다시 시도해 주세요.`
          );
        }
      }
    };

    el.micBtn.addEventListener("click", () => {
      if (isWaiting) return;
      if (isRecording) {
        recognizer.stop();
        return;
      }
      autoCaptureActive = false;
      try {
        recognizer.start();
        isRecording = true;
        el.micBtn.classList.add("recording");
      } catch (e) {
        /* already started or mic permission denied — ignore */
      }
    });
  }

  if (SpeechRecognitionImpl && window.speechSynthesis) {
    if (el.voiceModeField) el.voiceModeField.hidden = false;
    if (el.voiceModeBtn) el.voiceModeBtn.hidden = false;
    let savedVoiceMode = false;
    try {
      savedVoiceMode = localStorage.getItem("mock-interview-voice-mode") === "1";
    } catch (e) {
      /* ignore */
    }
    if (el.voiceModeCheckbox) el.voiceModeCheckbox.checked = savedVoiceMode;
    voiceMode = savedVoiceMode;
    if (el.voiceModeBtn) el.voiceModeBtn.classList.toggle("active", voiceMode);

    el.voiceModeCheckbox?.addEventListener("change", () => {
      setVoiceMode(el.voiceModeCheckbox.checked);
    });
    el.voiceModeBtn?.addEventListener("click", () => setVoiceMode(!voiceMode));
  }
}

/* ---- 생기부·자소서 파일 첨부 (어떤 파일이든 선택 가능 → 가능하면 텍스트 추출) ----
   전부 브라우저 안에서만 처리한다: PDF.js/Mammoth.js 라이브러리 코드만
   CDN에서 불러오고, 파일 내용 자체는 어디로도 전송되지 않는다.
   파일 선택 자체는 어떤 형식이든 막지 않되, 실제로 텍스트를 뽑아낼 수
   없는 형식(이미지, HWP, 옛 doc, 그 외 알 수 없는 바이너리 등)은
   친절한 안내 메시지로 대체한다 — 깨진 텍스트를 그대로 채워 넣지 않는다. */
const PDFJS_VERSION = "6.3.289";
const MAMMOTH_VERSION = "1.12.2";
const MAX_PERSONAL_INFO_CHARS = 6000;
let pdfjsLibPromise = null;
let mammothLibPromise = null;

function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`
    ).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothLibPromise) {
    mammothLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/mammoth/${MAMMOTH_VERSION}/mammoth.browser.min.js`;
      script.onload = () => resolve(window.mammoth);
      script.onerror = () => reject(new Error("mammoth.js 로드 실패"));
      document.head.appendChild(script);
    });
  }
  return mammothLibPromise;
}

async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }
  return pageTexts.join("\n").trim();
}

async function extractDocxText(file) {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").trim();
}

function getFileExt(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

// file.text()로 읽은 결과가 실제 문서 텍스트인지, 지원하지 않는 바이너리
// 파일(hwp, 이미지, 알 수 없는 형식 등)을 텍스트로 억지로 읽어 깨진
// 문자열이 나온 것인지 구분하기 위한 간단한 휴리스틱.
function looksLikeReadableText(str) {
  if (!str) return false;
  const sample = str.slice(0, 5000);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffd) bad++;
  }
  return bad / Math.max(sample.length, 1) < 0.02;
}

function setFileUploadStatus(text, kind) {
  if (!el.fileUploadStatus) return;
  el.fileUploadStatus.textContent = text;
  el.fileUploadStatus.className = `file-upload-status${kind ? ` ${kind}` : ""}`;
}

const UNSUPPORTED_FORMAT_GUIDE = {
  hwp: "HWP 파일은 자동 추출을 지원하지 않습니다. 한글에서 내용을 복사해 붙여넣거나, PDF·DOCX로 저장한 뒤 다시 첨부해 주세요.",
  hwpx: "HWP 파일은 자동 추출을 지원하지 않습니다. 한글에서 내용을 복사해 붙여넣거나, PDF·DOCX로 저장한 뒤 다시 첨부해 주세요.",
  doc: "옛 워드 형식(.doc)은 지원하지 않습니다. Word에서 '다른 이름으로 저장 → .docx'로 저장한 뒤 다시 시도해 주세요.",
};
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "heic", "tif", "tiff"];

async function handlePersonalInfoFile() {
  const file = el.personalInfoFile.files?.[0];
  if (!file) return;

  setFileUploadStatus(`"${file.name}" 처리 중...`);
  const ext = getFileExt(file.name);

  try {
    let text;

    if (file.type === "application/pdf" || ext === "pdf") {
      text = await extractPdfText(file);
    } else if (
      ext === "docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await extractDocxText(file);
    } else if (UNSUPPORTED_FORMAT_GUIDE[ext]) {
      setFileUploadStatus(UNSUPPORTED_FORMAT_GUIDE[ext], "error");
      return;
    } else if (IMAGE_EXTS.includes(ext) || file.type.startsWith("image/")) {
      setFileUploadStatus(
        "이미지 파일에서는 글자를 자동으로 읽어올 수 없습니다. 내용을 직접 입력하거나 텍스트 파일로 옮겨서 첨부해 주세요.",
        "error"
      );
      return;
    } else {
      const raw = await file.text();
      if (!looksLikeReadableText(raw)) {
        setFileUploadStatus(
          `"${file.name}"은(는) 지원하지 않는 파일 형식이에요. PDF, DOCX, TXT로 저장한 뒤 다시 첨부해 주세요.`,
          "error"
        );
        return;
      }
      text = raw;
    }

    text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      setFileUploadStatus(
        "텍스트를 추출하지 못했습니다 (스캔 이미지 PDF일 수 있어요). 내용을 직접 붙여넣어 주세요.",
        "error"
      );
      return;
    }

    const truncated = text.length > MAX_PERSONAL_INFO_CHARS;
    el.personalInfo.value = truncated ? text.slice(0, MAX_PERSONAL_INFO_CHARS) : text;
    setFileUploadStatus(
      `"${file.name}"에서 ${el.personalInfo.value.length.toLocaleString()}자 추출 완료${
        truncated ? " (내용이 길어 앞부분만 사용했어요)" : ""
      }. 필요하면 아래에서 직접 수정하세요.`,
      "success"
    );
  } catch (e) {
    setFileUploadStatus(
      "파일을 읽는 중 오류가 발생했습니다. PDF, DOCX, TXT 형식으로 저장한 뒤 다시 시도해 주세요.",
      "error"
    );
  } finally {
    el.personalInfoFile.value = "";
  }
}

function startInterview() {
  if (mode === "own") {
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
    apiKey = key;
    modelId = model;
  }
  el.setupError.hidden = true;

  settings = readSettingsFromForm();

  // 지원자가 면접 방식을 직접 고르지 않았다면 "서류기반면접"으로
  // 자동 설정하고 채팅창에 알려준다. 제시문면접은 별도의 결정적 제시문
  // 생성 로직이 필요해 사용자가 직접 선택했을 때만 쓴다.
  let autoSelectedStyle = null;
  if (!settings.interviewStyle) {
    autoSelectedStyle = "서류기반면접";
    settings.interviewStyle = autoSelectedStyle;
  }

  saveSettings(settings, apiKey, modelId);

  conversation = [];
  turnCount = 0;
  interviewFinished = false;
  el.messages.innerHTML = "";

  const headerBits = [settings.major, settings.admissionType, settings.interviewStyle].filter(
    Boolean
  );
  el.headerTitle.textContent = mode === "free" ? "모의면접 진행 중 (무료 체험)" : "모의면접 진행 중";
  el.headerSub.textContent = headerBits.length
    ? headerBits.join(" · ") + ` · ${settings.difficulty}`
    : `${settings.difficulty} 난이도`;

  if (el.topNav) el.topNav.hidden = true;
  if (el.heroSection) el.heroSection.hidden = true;
  if (el.featuresSection) el.featuresSection.hidden = true;
  el.setupScreen.hidden = true;
  el.interviewScreen.hidden = false;
  window.scrollTo(0, 0);
  el.chatInput.focus();

  if (autoSelectedStyle) {
    addBubble(
      "system",
      settings.personalInfo
        ? `면접 방식을 따로 고르지 않으셔서, 붙여넣으신 자기소개서·학생부 내용을 바탕으로 "${autoSelectedStyle}" 방식으로 자동 설정했습니다.`
        : `면접 방식을 따로 고르지 않으셔서 일반적인 "${autoSelectedStyle}" 방식으로 자동 설정했습니다.`
    );
  }

  startTimer();
  updateProgress();
  callClaude("면접을 시작해 주세요.");
}

function restartInterview() {
  stopTimer();
  window.speechSynthesis?.cancel();
  if (isRecording) recognizer?.stop();
  autoCaptureActive = false;
  el.interviewScreen.hidden = true;
  if (el.topNav) el.topNav.hidden = false;
  if (el.heroSection) el.heroSection.hidden = false;
  if (el.featuresSection) el.featuresSection.hidden = false;
  el.setupScreen.hidden = false;
  el.setupError.hidden = true;
  window.scrollTo(0, 0);
  if (loadHistory().length > 0 && el.historyToggle) el.historyToggle.hidden = false;
}

function handleSubmit(e) {
  e.preventDefault();
  if (isWaiting) return;
  const text = el.chatInput.value.trim();
  if (!text) return;
  addBubble("user", text);
  el.chatInput.value = "";
  turnCount += 1;
  updateProgress();
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

function formatHistoryDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

function renderHistoryList() {
  const list = loadHistory();
  if (list.length === 0) {
    el.historyList.innerHTML = `<p class="history-empty">아직 완료된 면접 기록이 없습니다.</p>`;
    return;
  }

  el.historyList.innerHTML = list
    .map((item) => {
      const bits = [item.major, item.admissionType, item.difficulty].filter(Boolean).join(" · ");
      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-item-head" data-action="toggle">
            <div>
              <div class="history-item-title">${escapeHtml(bits || "일반 면접")}</div>
              <div class="history-item-meta">${formatHistoryDate(item.date)}</div>
            </div>
            <div class="history-item-actions">
              <button type="button" data-action="copy">복사</button>
              <button type="button" data-action="delete">삭제</button>
            </div>
          </div>
          <div class="history-item-body" hidden>${escapeHtml(item.transcript)}</div>
        </div>`;
    })
    .join("");
}

function toggleHistory() {
  const willShow = el.historyPanel.hidden;
  el.historyPanel.hidden = !willShow;
  el.historyToggle.textContent = willShow ? "지난 면접 기록 닫기 ▲" : "지난 면접 기록 보기 ▼";
  if (willShow) renderHistoryList();
}

el.historyList.addEventListener("click", (e) => {
  const itemEl = e.target.closest(".history-item");
  if (!itemEl) return;
  const id = itemEl.dataset.id;
  const action = e.target.dataset.action;

  if (action === "toggle" || e.target.closest('[data-action="toggle"]')) {
    const body = itemEl.querySelector(".history-item-body");
    body.hidden = !body.hidden;
    return;
  }
  if (action === "delete") {
    const list = loadHistory().filter((h) => h.id !== id);
    saveHistory(list);
    renderHistoryList();
    if (list.length === 0) el.historyToggle.hidden = true;
    return;
  }
  if (action === "copy") {
    const item = loadHistory().find((h) => h.id === id);
    if (!item) return;
    navigator.clipboard?.writeText(item.transcript).catch(() => {});
    e.target.textContent = "복사됨";
    setTimeout(() => {
      e.target.textContent = "복사";
    }, 1200);
  }
});

el.bankToggle.addEventListener("click", toggleQuestionBank);
el.historyToggle.addEventListener("click", toggleHistory);
el.copyBtn.addEventListener("click", copyTranscript);
el.major.addEventListener("input", () => {
  if (!el.bankPanel.hidden) renderLatestLinks();
});
el.personalInfoFile?.addEventListener("change", handlePersonalInfoFile);
el.modeFreeBtn.addEventListener("click", () => setMode("free"));
el.modeOwnBtn.addEventListener("click", () => setMode("own"));
el.startBtn.addEventListener("click", startInterview);
el.restartBtn.addEventListener("click", restartInterview);
el.chatForm.addEventListener("submit", handleSubmit);
el.chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    el.chatForm.requestSubmit();
  }
});

setMode("free");
loadSavedSettings();
setupSpeechInput();
if (loadHistory().length > 0 && el.historyToggle) el.historyToggle.hidden = false;
