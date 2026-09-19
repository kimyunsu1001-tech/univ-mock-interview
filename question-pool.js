/* 모의 면접 AI — 실전형 질문 풀과 면접 진행 계획(무작위) 생성기.
   실제 면접처럼 "주 질문"은 준비된 질문 풀에서 뽑고, "꼬리질문"은 지원자의
   답변에 맞춰 AI가 만들되 어떤 유형으로 캐물을지는 면접 때마다 무작위로 정한다.
   질문 풀은 입학처 공개 자료와 입시 정보에서 반복적으로 확인되는 질문의 결을
   일반화해 정리한 것으로, 특정 대학·연도의 기출 원문이 아니다. */

const STAGE_ORDER = ["지원동기", "학교활동", "전공이해", "인성", "계획"];

const QUESTION_POOL = {
  지원동기: {
    common: [
      "우리 대학, 그리고 이 학과에 지원하게 된 가장 큰 이유가 무엇인가요?",
      "이 전공을 처음 마음먹게 된 결정적인 계기가 있다면 무엇인가요?",
      "다른 학과나 다른 대학이 아니라 이곳이어야 하는 이유를 말씀해 주세요.",
      "진로를 정하는 과정에서 가장 크게 고민했던 점은 무엇이었나요?",
      "만약 이 학과에 합격하지 못한다면 어떻게 하실 건가요? 그래도 이 진로를 계속 준비하실 건가요?",
      "고등학교 3년 동안 관심 분야가 바뀐 적이 있나요? 있다면 그 이유는 무엇인가요?",
      "이 학과에서 꼭 배우고 싶은 과목이나 교수님의 연구 분야가 있나요?",
      "지원한 전공에 대해 주변에서 걱정하거나 반대한 적이 있나요? 있다면 어떻게 설득하셨나요?",
      "이 학과를 졸업하면 어떤 일을 하게 된다고 알고 계신가요?",
      "본인이 이 학과에 적합한 사람이라고 생각하는 근거를 한 가지만 든다면 무엇인가요?",
    ],
    인문사회경영: [
      "경영·경제·사회 분야 중에서도 특별히 이 전공에 끌린 이유는 무엇인가요?",
      "사회 현상을 볼 때 본인만의 관점이나 관심사가 있다면 말씀해 주세요.",
      "이 분야를 공부하고 싶다고 느끼게 한 사회 문제나 뉴스가 있었나요?",
    ],
    자연공학: [
      "수학·과학 교과 중에서 이 전공과 가장 맞닿아 있다고 느낀 개념은 무엇인가요?",
      "이 분야를 공부하고 싶다고 느끼게 한 기술이나 사건이 있었나요?",
      "직접 무언가를 만들어 보거나 실험해 본 경험이 지원 동기와 어떻게 이어졌나요?",
    ],
    의약보건: [
      "의료·보건 분야를 선택한 이유와, 그 직업의 어떤 점이 본인과 맞는다고 생각하는지 말씀해 주세요.",
      "이 직업을 준비하면서 가장 힘들 것 같다고 예상하는 점은 무엇인가요?",
      "환자(또는 돌봄 대상)를 대할 때 가장 중요한 가치는 무엇이라고 생각하나요?",
    ],
    사범교육: [
      "교사라는 직업을 선택한 이유와, 다른 진로가 아니라 교사여야 하는 이유는 무엇인가요?",
      "기억에 남는 선생님이 있다면 어떤 점이 인상 깊었나요?",
      "좋은 교사가 되기 위해 지금 고등학생으로서 준비하고 있는 것이 있나요?",
    ],
  },

  학교활동: {
    common: [
      "고등학교 3년 동안 가장 의미 있었던 활동 하나를 소개하고, 왜 의미 있었는지 말씀해 주세요.",
      "그 활동에서 본인이 맡은 역할은 무엇이었고, 어떤 성과가 있었나요?",
      "동아리나 학교 활동 중 가장 어려웠던 순간과 그것을 극복한 과정을 말씀해 주세요.",
      "교과 시간에 배운 내용을 스스로 확장해서 탐구해 본 경험이 있나요?",
      "독서 활동 중 본인의 생각을 바꾼 책이 있다면 소개해 주세요.",
      "진로와 관련해 스스로 계획하고 실행해 본 활동이 있다면 소개해 주세요.",
      "학급이나 학교에서 리더 역할을 맡았던 경험이 있다면 말씀해 주세요.",
      "봉사활동이나 나눔 활동 중 기억에 남는 경험과 그때 느낀 점을 말씀해 주세요.",
      "가장 열정을 쏟았던 교과목과 그 이유를 말씀해 주세요.",
      "활동을 하면서 본인의 예상과 다른 결과가 나온 경험이 있나요?",
    ],
  },

  전공이해: {
    common: [
      "지원한 전공에서 배우는 핵심 내용을 본인의 말로 간단히 설명해 보세요.",
      "이 전공과 관련해 최근 관심 있게 본 이슈나 뉴스가 있다면 소개해 주세요.",
      "이 전공을 공부하는 데 가장 필요한 역량은 무엇이라고 생각하고, 본인은 얼마나 갖췄다고 보나요?",
      "이 분야의 대표적인 인물이나 책을 하나 소개하고, 왜 인상 깊었는지 말씀해 주세요.",
      "이 전공이 사회에 기여할 수 있는 가장 큰 부분은 무엇이라고 생각하나요?",
      "이 분야가 앞으로 10년 뒤 어떻게 바뀔 것이라고 생각하나요?",
    ],
    인문사회경영: [
      "최근 경제·사회 이슈 중 하나를 골라, 원인과 해결 방안에 대한 본인의 생각을 말씀해 주세요.",
      "기업이 이윤 추구와 사회적 책임을 함께 져야 한다고 생각하나요? 근거와 함께 말씀해 주세요.",
      "인공지능이 일자리에 미치는 영향에 대해 어떻게 생각하시나요?",
      "정부가 시장에 개입하는 것에 대해 본인은 어떤 입장인가요?",
      "저출생·고령화 문제가 본인이 지원한 분야에 어떤 영향을 미칠 것이라고 보나요?",
    ],
    자연공학: [
      "최근 관심 있게 본 과학기술 이슈를 하나 소개하고, 장단점을 함께 말씀해 주세요.",
      "생성형 인공지능이 발전하면서 생기는 문제와 해결 방향에 대한 본인의 생각을 말씀해 주세요.",
      "기술 발전이 환경에 미치는 영향에 대해 어떻게 생각하나요?",
      "수학이나 과학 교과에서 어려웠던 개념을 하나 골라, 어떻게 이해하게 되었는지 설명해 보세요.",
      "실패한 실험(또는 프로젝트)에서 원인을 찾아본 경험이 있다면 소개해 주세요.",
    ],
    의약보건: [
      "의료 현장에서 인공지능이 진단을 보조하는 것에 대해 어떻게 생각하나요?",
      "고령화 사회에서 의료·간호의 역할이 어떻게 달라져야 한다고 생각하나요?",
      "의료인에게 가장 필요한 윤리 원칙은 무엇이며, 그 원칙들이 충돌하는 상황을 예로 들어 설명해 보세요.",
      "환자가 치료를 거부하는 상황이라면 어떻게 대응하시겠어요?",
    ],
    사범교육: [
      "학교 현장에서 생성형 인공지능을 어떻게 활용해야 한다고 생각하나요?",
      "학생 인권과 교권이 충돌하는 상황에서 교사는 어떻게 해야 한다고 생각하나요?",
      "수업 시간에 집중하지 않는 학생을 만났을 때 어떻게 대처하시겠어요?",
      "학교폭력이 발생했을 때 교사가 가장 먼저 해야 할 일은 무엇이라고 생각하나요?",
    ],
  },

  인성: {
    common: [
      "친구나 팀원과 의견이 크게 충돌했던 경험과 해결 과정을 말씀해 주세요.",
      "가장 크게 실패했던 경험과 그로부터 배운 점은 무엇인가요?",
      "본인 성격의 가장 큰 장점과 단점을 각각 말씀해 주세요. 단점은 어떻게 보완하고 있나요?",
      "팀 프로젝트에서 역할을 다하지 않는 팀원이 있다면 어떻게 하시겠어요?",
      "규칙과 친구와의 의리가 충돌하는 상황이라면 어떻게 하시겠어요?",
      "시험 기간과 다른 중요한 활동 일정이 겹쳤던 적이 있나요? 어떻게 시간을 관리했나요?",
      "누군가를 도왔던 경험이나, 반대로 도움을 받아 성장했던 경험을 말씀해 주세요.",
      "스트레스를 받을 때 본인만의 해소 방법이 있나요?",
      "주변에서 본인을 어떤 사람이라고 평가하나요? 그 평가에 동의하나요?",
      "살면서 가장 정직해야 했던 순간과 그때 어떤 선택을 했는지 말씀해 주세요.",
      "본인이 생각하는 리더의 조건은 무엇이며, 본인은 그 조건을 얼마나 갖췄나요?",
      "실수를 했을 때 그것을 인정하고 바로잡았던 경험이 있나요?",
    ],
  },

  계획: {
    common: [
      "입학한 뒤 1학년 때 가장 먼저 도전해 보고 싶은 것은 무엇인가요?",
      "대학 4년 동안의 학업 계획을 구체적으로 말씀해 주세요.",
      "졸업 후 10년 뒤 어떤 모습이 되어 있기를 바라나요?",
      "대학에서 이루고 싶은 목표와, 그것을 위해 지금부터 준비하고 있는 것은 무엇인가요?",
      "이 학과에서 배운 것을 사회에 어떻게 환원하고 싶나요?",
      "대학 생활에서 학업 외에 꼭 해보고 싶은 활동이 있나요?",
      "입학 후 전공이 생각과 다르다고 느낀다면 어떻게 하시겠어요?",
      "이 학과의 후배들에게 어떤 선배가 되고 싶나요?",
    ],
  },
};

// 자기소개서·학생부 내용이 있을 때 "학교활동" 자리에는 고정 질문 대신, 그 내용에서
// 아직 묻지 않은 활동을 AI가 골라 묻게 한다.
const DOCUMENT_HINTS = [
  "제공된 자기소개서·학생부 내용에 적힌 활동 중 아직 묻지 않은 것 하나를 골라, 그 활동을 하게 된 계기와 본인이 맡은 역할을 묻는 질문",
  "제공된 자기소개서·학생부 내용의 독서·탐구·진로 활동 중 하나를 골라, 그 활동에서 얻은 결론이나 배운 점을 묻는 질문",
  "제공된 자기소개서·학생부 내용 중 가장 인상적인 기록 하나를 골라, 그 활동의 과정에서 겪은 어려움과 해결 방법을 묻는 질문",
];

// 꼬리질문 유형. 면접 때마다 무작위로 순서를 섞어 하나씩 쓴다.
const FOLLOWUP_TYPES = [
  "이유 캐묻기 — 그렇게 판단하거나 선택한 이유와 근거를 묻는다",
  "구체 사례 요구 — 말한 내용을 뒷받침하는 실제 경험 하나를 구체적으로 묻는다",
  "반대 관점 제시 — 반대 입장에서는 이렇게 볼 수도 있다고 짚고 어떻게 생각하는지 묻는다",
  "가정 상황 — 조건이 달라지거나 반대 상황이라면 어떻게 하겠는지 묻는다",
  "역할·과정 확인 — 본인이 직접 한 일과 그 과정에서 가장 어려웠던 점을 묻는다",
  "결과 확인 — 그 결과 무엇이 어떻게 달라졌는지, 어떤 근거로 성과를 판단하는지 묻는다",
  "배운 점 — 그 경험 이후 생각이나 행동이 어떻게 바뀌었는지 묻는다",
  "아쉬운 점 — 아쉬웠던 부분과, 다시 한다면 무엇을 바꿀지 묻는다",
  "전공 연결 — 그 이야기가 지원 전공·진로와 어떻게 이어지는지 묻는다",
  "반복 확인 — 방금 말한 핵심 표현 하나를 골라 다른 각도에서 다시 확인한다",
];

// 난이도 "심화"에서만 추가로 섞이는 압박형 유형(논리로만 압박, 무례하지 않게).
const PRESSURE_FOLLOWUP_TYPES = [
  "압박 확인 — 그 방법이 최선이었다고 확신하는지, 논리의 허점이나 앞뒤가 다른 부분이 없는지 정중하지만 날카롭게 묻는다",
  "대안 추궁 — 다른 방법은 없었는지, 왜 그 방법만 택했는지 묻는다",
];

const ASKED_KEY = "mock-interview-asked-v1";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function detectTrack(major) {
  const m = (major || "").trim();
  if (!m) return null;
  if (/간호|의예|의학|치의|약학|한의|보건|물리치료|작업치료|방사선|임상병리|응급구조|수의|재활/.test(m)) return "의약보건";
  if (/교육|사범|교사|유아|초등/.test(m)) return "사범교육";
  if (/공학|컴퓨터|소프트웨어|전자|전기|기계|화학|물리|수학|통계|생명|생물|지구|환경|건축|산업|인공지능|데이터|반도체|신소재|항공|자동차|로봇|천문|농|식품|IT|AI/i.test(m)) return "자연공학";
  return "인문사회경영";
}

function loadAskedQuestions() {
  try {
    const raw = localStorage.getItem(ASKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveAskedQuestions(list) {
  try {
    localStorage.setItem(ASKED_KEY, JSON.stringify(list.slice(-80)));
  } catch (e) {
    /* storage unavailable — non-fatal */
  }
}

// 최근 면접에서 이미 쓴 질문은 피해서 뽑는다(후보를 다 썼다면 그 후보들만 기록에서 지우고 다시 뽑는다).
function pickQuestion(stage, track, exclude = []) {
  const pool = QUESTION_POOL[stage] || {};
  // 같은 면접 안에서는 절대 같은 질문이 두 번 나오지 않도록 exclude(이미 뽑은 질문)를 뺀다
  const candidates = [...(pool.common || []), ...((track && pool[track]) || [])].filter((q) => !exclude.includes(q));
  if (!candidates.length) return null;
  let asked = loadAskedQuestions();
  let fresh = candidates.filter((q) => !asked.includes(q));
  if (!fresh.length) {
    asked = asked.filter((q) => !candidates.includes(q));
    fresh = candidates;
  }
  const q = fresh[randInt(0, fresh.length - 1)];
  asked.push(q);
  saveAskedQuestions(asked);
  return q;
}

/* 면접 한 판의 진행 계획(약 10분 분량). 사용자가 답변할 때마다 queue의 다음 단계를 하나씩 쓴다.
   - 주 질문 8~10개(제시문면접은 6~7개 + 제시문) + 꼬리질문 전체 3~5개를 매번 무작위로 배치한다.
     꼬리질문은 어느 주 질문 뒤에 붙을지, 어떤 유형으로 캐물을지가 면접마다 달라진다.
   - open은 첫 요청(면접 시작)이라 queue에 없다.
   - kind: followup(꼬리질문) | main(주 질문) | passage(제시문) | closing(마지막 질문) | evaluate(평가) */
const TARGET_MINUTES = 10;

function buildInterviewPlan(s) {
  const deep = s.difficulty === "심화";
  const presentation = s.interviewStyle === "제시문면접";
  const hasDoc = !!(s.personalInfo && s.personalInfo.trim());
  const track = detectTrack(s.major);

  // 단계별 주 질문 개수: 기본 9개 구성에서 목표 개수(8~10)에 맞춰 무작위로 가감한다.
  const counts = { 지원동기: 2, 학교활동: 2, 전공이해: 2, 인성: 2, 계획: 1 };
  const mins = { 지원동기: 1, 학교활동: 1, 전공이해: 1, 인성: 1, 계획: 0 };
  const total = presentation ? randInt(6, 7) : deep ? randInt(9, 10) : randInt(8, 10);
  let current = 9;
  while (current > total) {
    const cand = STAGE_ORDER.filter((st) => counts[st] > mins[st]);
    counts[cand[randInt(0, cand.length - 1)]]--;
    current--;
  }
  while (current < total) {
    const cand = ["지원동기", "학교활동", "전공이해", "인성"];
    counts[cand[randInt(0, cand.length - 1)]]++;
    current++;
  }
  const mainStages = [];
  STAGE_ORDER.forEach((st) => {
    for (let i = 0; i < counts[st]; i++) mainStages.push(st);
  });

  // 꼬리질문은 면접 전체에서 3~5개(심화는 5개, 그중 압박형 1개 이상 포함)
  const followTotal = deep ? 5 : randInt(3, 5);
  let followTypes = shuffled(FOLLOWUP_TYPES).slice(0, followTotal);
  if (deep) {
    followTypes = shuffled([
      PRESSURE_FOLLOWUP_TYPES[randInt(0, PRESSURE_FOLLOWUP_TYPES.length - 1)],
      ...followTypes.slice(0, followTotal - 1),
    ]);
  }
  let ft = 0;
  const nextFollowup = () => ({ kind: "followup", hint: followTypes[ft++ % followTypes.length] });

  const passageFollow = presentation ? (deep ? 3 : 2) : 0; // 제시문 직후 꼬리질문은 항상 붙인다
  const generalFollow = Math.max(followTotal - passageFollow, 1);
  // 자리 0 = 자기소개 직후, 1..N = 각 주 질문 직후. 그중 generalFollow개를 무작위로 골라 꼬리질문을 붙인다.
  const slots = new Set(
    shuffled(Array.from({ length: mainStages.length + 1 }, (_, i) => i)).slice(0, generalFollow)
  );

  const usedQuestions = [];
  const docHints = shuffled(DOCUMENT_HINTS);
  let docIdx = 0;
  const queue = [];
  if (slots.has(0)) queue.push(nextFollowup());
  if (presentation) {
    queue.push({ kind: "passage" });
    for (let i = 0; i < passageFollow; i++) queue.push(nextFollowup());
  }
  mainStages.forEach((stage, i) => {
    if (stage === "학교활동" && hasDoc) {
      queue.push({ kind: "main", stage, question: null, hint: docHints[docIdx++ % docHints.length] });
    } else {
      const q = pickQuestion(stage, track, usedQuestions);
      usedQuestions.push(q);
      queue.push({ kind: "main", stage, question: q });
    }
    if (slots.has(i + 1)) queue.push(nextFollowup());
  });

  queue.push({ kind: "closing" });
  queue.push({ kind: "evaluate" });
  return { queue, index: 0 };
}

// 본인 API 키 모드(서버 개입 없음)에서 마지막 사용자 메시지에 덧붙이는 이번 턴 지시문.
function turnDirectiveText(turn) {
  if (!turn) return "";
  switch (turn.kind) {
    case "followup":
      return `\n\n[진행 지침: 짧은 인정 표현 한 문장 뒤에, 지원자의 방금 답변에 나온 구체적인 표현을 자연스럽게 넣어 아래 유형의 꼬리질문을 딱 한 개만 하세요 — ${turn.hint}]`;
    case "main":
      return turn.question
        ? `\n\n[진행 지침: 짧은 인정 표현 한 문장 뒤에, 다음 질문을 표현을 바꾸지 말고 그대로 딱 하나만 하세요: "${turn.question}"]`
        : `\n\n[진행 지침: 짧은 인정 표현 한 문장 뒤에, ${turn.hint}을 딱 한 개만 하세요.]`;
    case "passage":
      return "\n\n[진행 지침: 짧은 인정 표현 뒤에 '제시문 준비' 절차에 따라 지금 제시문을 제시하고 분석형 질문을 하세요.]";
    case "closing":
      return '\n\n[진행 지침: "네, 답변 잘 들었습니다." 다음에 "마지막으로 하고 싶은 말씀이 있으면 해주세요."만 물으세요. 다른 질문은 하지 마세요.]';
    case "evaluate":
      return "\n\n[진행 지침: 면접이 끝났습니다. 새 질문 없이 평가 및 피드백 형식대로 평가만 작성하세요.]";
    default:
      return "";
  }
}
