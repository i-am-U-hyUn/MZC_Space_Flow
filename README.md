# MZC SpaceFlow

> **일잘러 영업팀을 위한 PoA 작성 자동화 플랫폼**
> AWS 파트너사 영업·기술 담당자의 PoA (Proof of Authority) 문서 작성 비효율을 제거하는 Bedrock AgentCore 기반 자율 에이전트.

- 📸 [스크린샷]
![요건 정의 Cover](docs/previews/requirements-cover.png)
[요건 정의 및 서비스 기획안 시나리오_Team 37_S3.pdf](https://github.com/user-attachments/files/27578045/_Team.37_S3.pdf)
- 👥 Team 37 / MegazoneCloud

---

## 🎯 해결하는 문제

| 항목 | 현재 |
|---|---|
| 1건 평균 작성 시간 | **5일** |
| Reject 포함 실질 | **8일** |
| 연간 Reject율 | **30%** (54건 중 16건) |
| 연간 누적 공수 | **약 318일** |

> **5일이 Reject 시 8일로, 연 318일 공수가 영업 기회 발굴을 막는다.**
> SpaceFlow는 이 병목을 3단계 자율 에이전트로 해소해 **수 시간**으로 단축한다.

---

## ✨ 핵심 기능

- **비정형 자료 → 구조화** · 이메일·메모·미팅록 입력 → 고객사·요구사항·기술스택·예산·일정 자동 추출
- **승인 문서 기반 초안 (RAG)** · Bedrock Knowledge Bases에 적재된 과거 승인 PoA·SOW 패턴 참조
- **앞단 → 뒷단 자동 연동** · Stakeholder · Partner · Project Team 입력이 **Resource & Cost Role Rates**에 자동 주입
- **QA/QC — Lint for Document** · 9개 평가 기준으로 제출 전 통과 확률 진단 및 보완 권장
- **Approve / Reject Change Request** · AS-IS / TO-BE diff 기반 변경 승인 워크플로우
- **Export DOCX** · APN 템플릿 포맷 산출물 생성

---

## 🏗️ 기술 구성

- 📄 [아키텍처 설계서] 
[아키텍처 설계서_Team 37_S3.pdf](https://github.com/user-attachments/files/27578057/_Team.37_S3.pdf)


| Layer | 기술 |
|---|---|
| Agent Runtime | **Amazon Bedrock AgentCore** (Parent Orchestrator + QA/QC · Resource · Architecture 서브 에이전트) |
| Tool Integration | **MCP (Model Context Protocol)** · Bedrock KB MCP · AWS Documentation / Pricing MCP · Custom Calculator · Draw.io MCP |
| Knowledge | **Bedrock Knowledge Bases (RAG)** · 승인 PoA · SOW 코퍼스 |
| Backend | **AWS Lambda (Serverless)** · API Gateway · DynamoDB · S3 |
| Auth & Security | **Amazon Cognito** · IAM Role 기반 접근 제어 · Bedrock Guardrails |
| Frontend | **React + Vite + TypeScript** · AWS AppSync |
| Deploy | S3 + CloudFront · Lambda |

---

## 📁 저장소 구조

```
MZC_Space_Flow/
├── agent/           # Bedrock AgentCore 기반 자율 에이전트 (Python)
│   ├── app/         #   - Parent Orchestrator, QA/QC, Resource, Architecture 서브 에이전트
│   ├── lambdas/     #   - Gateway Tools · Document API · Calculator · Export DOCX
│   ├── lib/         #   - Schema · Storage · Memory · Calculation
│   ├── data/presets # - Role catalog · Rate card · Phase hour patterns
│   └── templates/   # - APN PoC DOCX 템플릿
├── front/           # React + Vite + TypeScript 프론트엔드
│   └── src/
│       ├── components/  # Editor · Panels · Sections · Admin
│       ├── auth/        # Cognito 연동
│       └── utils/       # AppSync · Schema · Review 어댑터
├── docs/            # 제출 문서
│   ├── Architecture_Design_Team37_S3.pdf
│   └── Requirements_And_Service_Plan_Team37_S3.pdf
├── .gitignore
└── README.md
```

---

## 📄 제출 문서

| 문서 | 경로 |
|---|---|
| 요건 정의 및 서비스 기획안 시나리오 | [`docs/Requirements_And_Service_Plan_Team37_S3.pdf`](docs/Requirements_And_Service_Plan_Team37_S3.pdf) |
| 아키텍처 설계서 | [`docs/Architecture_Design_Team37_S3.pdf`](docs/Architecture_Design_Team37_S3.pdf) |

---

## 📊 비즈니스 임팩트

- **문서 작성 공수** · 초안 5일 → 수 시간, Reject 재작성 +3일 → 공유 드라이브 방식으로 최소화
- **환산 매출 기회비용** · 영업 1인당 연 100억 (1조 ÷ 100명, 2025년 영업일 246일) 기준 → 318일 공수는 **약 129.3억 원**의 기회 손실
- **펀딩 실행력** · Reject율 30% → 절반 감소 시 **연 약 $315K (4.5억 원)** 펀딩 손실 방어
- **확장성** · PoA / SOW → 제안서 · RFP · 고객 보고서 등 영업 문서 전반으로 확산
- **사업 연계** · MegazoneCloud 고객 파이프라인 및 SFDC 연동 시 펀딩 실적 반영 가능

---

## 🚀 개발·배포

### Agent (Python)
```bash
cd agent
uv sync            # 또는 pip install -e .
pytest             # 단위·통합 테스트
```

### Frontend (React + Vite)
```bash
cd front
npm install
npm run dev        # 로컬 개발 서버
npm run build      # 프로덕션 빌드
```

---

## 👥 팀 구성

| 역할 | 책임 |
|---|---|
| **CTU Engineering** | Bedrock AgentCore · Lambda · MCP 서버 · RAG 파이프라인 개발 |
| **OPS** | 요건 정의 · 서비스 기획안 · 랜딩 페이지 · UX 설계 |
| **Sales Domain Expert** | 실제 PoA 문서 자료 제공 · 현업 병목 지점 도출 · QA/QC 체크리스트 검증 |

---

## 📜 License

Internal use only · MegazoneCloud Team 37
