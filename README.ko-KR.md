# 전과 수첩 · Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

**poi 12.0.1+**용 로컬 전과 기록 플러그인입니다.

## 기능

- 이전 달 기록과 날짜별·시간별 전과를 표시하며 날짜나 시간을 누르면 상세 기록을 확인할 수 있습니다.
- 출격·연습전·원정의 일반 전과를 `제독 경험치 × 7 / 10000`으로 계산합니다. EO와 지원하는 임무 전과는 집계에 표시합니다.
- 로컬 미기록 경험치 전과는 합계와 발생 가능 구간으로 별도 표시하며 로그인한 날짜나 시간에 합산하지 않습니다.
- 자신과 **1·5·20·100·500위**의 순위 전과, 자신과의 차이, 직전 갱신 대비 증감을 표시합니다.
- 상세 기록은 버튼과 마우스 휠로 페이지를 넘길 수 있습니다. 창 높이에 따라 페이지당 최대 10건을 표시합니다.
- 시간대 저장, 계정 목록의 제독명 표시, CSV 내보내기, JSON 백업, 계정별 저장을 지원합니다.
- 한국어·영어·일본어·중국어 간체 및 번체에 대응하며 메인 패널과 별도 창에서 사용할 수 있습니다.

## 사용 방법

1. poi 플러그인 관리에서 `poi-plugin-senka-ledger`를 설치하거나 [GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases)의 `.tgz`를 사용합니다.
2. 활성화 후 모항에 들어가 제독 경험치 기준을 받습니다.
3. 계정·월·시간대를 선택합니다. 시간대는 다음에 열 때도 유지됩니다. 제독명은 모항 데이터에서 읽으며 아직 읽지 못한 계정은 ID로 표시합니다. 날짜를 누르면 시간별 전과를, 시간을 누르면 상세 기록을 표시합니다.

순위 기록은 게임 내에서 해당 순위 페이지를 열어 수집합니다. 차이는 매일 일본 시간 **03:00／15:00**에 갱신되는 바로 이전 순위와 비교하며 이전 기록이 없으면 `—`로 표시합니다. 플러그인이 게임 요청을 보내지는 않습니다.

## 데이터

기록은 사용을 시작한 때부터 쌓이며 로컬 보상은 결과 응답을 받은 시각으로 기록합니다. 미기록 증가량은 전체 발생 가능 구간의 값을 보존하므로 여러 날짜·월에 걸친 구간 합계를 다시 더하면 안 됩니다. 활동 집계에는 공식 순위 이월이나 월말 조정이 포함되지 않습니다.

지원하는 전과 임무: `854, 888, 893, 872, 284, 845, 903`.

시작이 멈추거나 설정 파일이 비정상적으로 커진 경우 [설정 복구 안내](https://github.com/asparagusThief/poi-plugin-senka-ledger/blob/main/docs/recovery.md)를 참고하세요.

로그 위치는 `APPDATA_PATH/senka-ledger/<계정ID>.jsonl`입니다. JSON은 PC 이전, poi 재설치, 데이터 손상 시 전체 기록을 복원하는 데 사용합니다. 복원하려면 모든 poi를 종료하고 기존 파일을 백업한 다음 JSON의 `journal` 내용을 이 폴더의 `<계정ID>.jsonl`로 저장하세요. 화면에서 가져오기 기능은 아직 없습니다. 일상적인 조회와 분석에는 CSV를 사용할 수 있습니다. token·비밀번호·전체 API 응답은 저장하지 않습니다.

## 미리 보기

이미지는 예시 데이터를 사용합니다.

![월별 보기](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![시간별 보기](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![상세 창](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

## 개발

Node.js 20+가 필요하며 실행 라이브러리는 poi에서 제공합니다.

```text
npm run check
npm test
npm run pack:local
```

패키지는 `dist/`에 생성됩니다. `scripts/install-local.ps1`로 소스에서 설치할 수 있으며 기존 플러그인을 덮어쓰지 않습니다.

MIT 라이선스.
