# 모의면접 AI

AI 면접관과 함께 연습하는 대학 입시 모의면접 웹앱입니다. 지원 학과, 전형 유형,
면접 방식, 난이도를 설정하면 실제 면접처럼 자기소개 → 지원동기 → 전공/활동 →
인성 질문 → 마지막 할 말 순서로 질문과 꼬리질문이 이어지고, 면접이 끝나면
항목별 평가와 피드백을 받을 수 있습니다. 계열별 실전 질문 은행과 최신
기출·면접 후기를 바로 검색할 수 있는 링크도 제공합니다.

**배포 페이지:** https://kimyunsu1001-tech.github.io/univ-mock-interview/

## 사용 방법

이용 모드는 두 가지입니다.

**① 무료로 체험하기 (기본값, API 키 불필요)**
- 아무 설정 없이 바로 "면접 시작하기"를 누르면 됩니다.
- [interview-proxy](https://github.com/kimyunsu1001-tech/mock-interview-proxy) Cloudflare
  Worker를 통해 방문자 IP당 하루 14메시지까지 무료로 이용할 수 있습니다 (경량
  오픈소스 모델 사용, 매일 초기화).

**② 내 API 키 사용 (더 높은 품질, 무제한)**
1. "내 API 키 사용" 탭을 선택합니다.
2. 본인의 [Anthropic API 키](https://console.anthropic.com/settings/keys)를 입력합니다.
   - 키는 브라우저 `localStorage`에만 저장되며, Anthropic API 서버 외에는 전송되지 않습니다.
   - 이 저장소나 배포 서버 어디에도 키가 저장되지 않습니다.

공통: 지원 학과·전형 유형·면접 방식·난이도를 선택하고 "면접 시작하기"를
누르면 실제 면접처럼 질문과 꼬리질문이 이어지고, 면접이 끝나면 자동으로
항목별 평가가 제공됩니다.

## 기술 스택

프론트엔드는 순수 HTML/CSS/JavaScript(빌드 도구 없음)로 작성되어 GitHub
Pages 등 정적 호스팅에 바로 배포할 수 있습니다. 무료 체험 모드는
[Cloudflare Worker 프록시](https://github.com/kimyunsu1001-tech/mock-interview-proxy)를
거쳐 Cloudflare Workers AI를 호출하고, 본인 API 키 모드는 클라이언트에서
[Anthropic Messages API](https://docs.anthropic.com/)를 직접 호출합니다.

## 로컬 실행

별도 빌드 과정 없이 `index.html`을 브라우저로 열면 바로 동작합니다.

```bash
# 예: 간단한 정적 서버로 실행
npx serve .
```

## 주의사항

- API 키는 절대 저장소에 커밋하지 마세요.
- 이 앱은 사용자가 자신의 API 키로 직접 Anthropic API를 호출하는 구조이며,
  API 사용 요금은 키 소유자에게 청구됩니다.
