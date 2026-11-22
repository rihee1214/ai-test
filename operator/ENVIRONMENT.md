# 환경과 스킬 고정표

기준 HEAD 2f464abb38c74bd7c8e1cd566aac74c40115f1cd. Windows 체크아웃 원본 데이터 SHA-256 f4a65fe67f4376fedf218cb6f9f4ddc8f0c0b079efa2fd98b5590d72d54e7290.

|항목|준비 시 확인|실행 전 적용할 값·조치|367 / 581 / 214 / 796 실측|
|---|---|---|---|
|운영 환경|Windows·PowerShell|같은 머신, 계정, 셸. 독립 복제본|실행 전 확인|
|모델·추론 강도|세션 지침에 GPT-6 기반 Codex로 표시. 선택 ID·강도는 실행 전 확인|동일한 명시 선택값|실행 전 확인|
|도구|Git 2.45.1.windows.1, Node 24.20.0, npm 11.19.0, 로컬 codex-cli 0.171.0|같은 실행 클라이언트·빌드와 도구 버전|실행 전 확인|
|브라우저|설치된 Edge 157.0.4341.46|같은 빌드·디스플레이 배율, 960×640, 100%, 빈 프로필|실행 전 확인|
|지침·컨텍스트|공통 개발자 지침과 사용 가능 목록 노출|같은 공통 지침과 메모리 설정. 이전 실행 공유 차단. 원문 또는 해시 보관|실행 전 확인|
|샌드박스·기본 권한|준비 세션 workspace-write, 네트워크 제한, granular 승인, 기존 명령 예외 있음|작업 루트 외 같은 기본 권한·예외·서브에이전트 정책|실행 전 확인|
|Auto-review|준비 세션의 범주별 정책은 표시됨. 실제 클라이언트 선택값은 실행 전 확인|모든 조건 Auto-review. 수동 승인 기준도 동일. 개별 실행만 권한 확대 금지|실행 전 확인|
|스킬·도구·훅|아래 명세. 실행 세션별 동반 변화는 실행 전 확인|각 세션에서 목록과 앱 권한 대조, 증거 위치 기록|실행 전 확인|

실행 시에도 보이지 않는 값은 ‘확인 불가’로 입력한다.

## 조작 대상 · 설치 manifest 버전

- **superpowers 7.0.1** (15개) — brainstorming, diagnosing-superpowers, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills.
- **computer-use 26.1117.31558** (1개) — computer-use.
- 전자는 계획·구현·검증 절차를, 후자는 화면 자체 검증을 지원한다. 패키지 버전만 확인됐고 개별 스킬의 독립 버전은 확인 불가다. 설치를 추가하지 않는다.

## 대상 외 상태

- 준비 세션의 제외 플러그인 스킬 그룹은 codex-security, pages, documents, pdf, presentations, sites, spreadsheets, plugin-management, template-creator, visualize, work-pets다. 실제 전체 목록과 표시 버전을 첫 실행 전에 캡처하고 네 조건에서 유지한다.
- 기본 제공 목록에는 imagegen, openai-docs, skill-creator, skill-installer가 노출됐다. 시스템 폴더의 create-statusline, review-agent는 준비 세션 목록에 보이지 않았다. 기본 제공 스킬은 네 실행에서 같은 상태로 둔다.
- 강제 활성 또는 비활성화 불가로 확인된 항목은 준비 시점에 특정되지 않았다. 실행 전 관리 정책에 잠김이 보이는 항목만 별도로 적는다. 잠금 확인 항목 ______, 근거 ______.

## 실제 설정 검증

1. 측정 세션을 열기 전에 ON/OFF 점검용 세션에서 실제 사용 가능 목록, 도구 이름·훅·앱 접근권을 비교한다. 설정 화면과 세션의 스킬 목록을 보관한다. 디스크의 설치 파일만으로 판정하지 않는다.
2. OFF는 **Superpowers 플러그인 자체를 끄고** Computer Use는 플러그인을 유지한 채 해당 스킬만 비활성화하는 방식을 우선한다. 지원되는 로컬 설정 예시는 아래와 같다. 설정 변경 후 클라이언트를 재시작하고 새 세션에서 superpowers:* 전체와 computer-use:computer-use가 모두 빠졌는지 확인한다.
3. 스킬 단독 비활성화가 반영되지 않으면 두 OFF 모두 Computer Use 플러그인까지 끄는 방식으로 사전 고정한다. 대상이 남은 상태에서는 설정을 바로잡고 새 세션으로 재확인한다. 프롬프트로 대체하지 않는다.
4. ON은 동일 버전의 두 플러그인을 켜고 스킬 단독 제한을 해제한다. 두 ON 모두 위 16개가 실제로 노출돼야 한다. 자동 선택은 에이전트에 맡긴다. 호출 없음도 유효하다.
5. Superpowers 설치 manifest에는 스킬 선언이 있고 별도 MCP·훅 선언은 보이지 않았다. Computer Use에는 Stop, SubagentStop, Interrupt에서 node_repl.turn_ended를 부르는 훅이 있다. 준비 세션의 CUA 도구에는 unified-computer-use 출처도 표시됐다. 실제로 사라진 도구·권한은 양쪽 목록에서 확인한다. 맞출 수 없는 차이는 실행 전에 아래에 명시하고 결과에 묶음과 동반 도구의 합산 차이로 반영한다.

```toml
[[skills.config]]
path = "D:/SymLinks/.codex/plugins/cache/openai-bundled/computer-use/26.1117.31558/skills/computer-use/SKILL.md"
enabled = false
```

[Codex 스킬 설정 문서](https://learn.chatgpt.com/docs/build-skills)

OFF 방식 ______ / ON 목록 근거 ______ / OFF 목록 근거 ______ / 고정할 수 없었던 도구·훅·권한 차이 ______ / 기록 시각 ______.
