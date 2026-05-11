import { useState, useEffect } from 'react'
import { navigate } from '../utils/hashRoute'

type Tab = 'p1' | 'p2'

export default function LandingPage() {
  const [tab, setTab] = useState<Tab>('p1')

  useEffect(() => {
    // Load Pretendard font
    const linkPreconnect = document.createElement('link')
    linkPreconnect.rel = 'preconnect'
    linkPreconnect.href = 'https://cdn.jsdelivr.net'
    document.head.appendChild(linkPreconnect)

    const linkFont = document.createElement('link')
    linkFont.rel = 'stylesheet'
    linkFont.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css'
    document.head.appendChild(linkFont)

    return () => {
      document.head.removeChild(linkPreconnect)
      document.head.removeChild(linkFont)
    }
  }, [])

  const selectTab = (next: Tab) => {
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goLogin = () => navigate('#/login')

  return (
    <div className="lp-root">
      <style>{LANDING_CSS}</style>

      <nav className="nav">
        <div className="nav-inner">
          <a href="#" className="brand" onClick={e => { e.preventDefault(); selectTab('p1') }}>
            <img src="/logo.png" alt="SpaceFlow" className="brand-mark" />
            <span>SpaceFlow</span>
            <span className="brand-sub">PoA Funding Platform</span>
          </a>
          <div className="tabs">
            <button
              className={`tab ${tab === 'p1' ? 'active' : ''}`}
              onClick={() => selectTab('p1')}
            >
              Requirements
            </button>
            <button
              className={`tab ${tab === 'p2' ? 'active' : ''}`}
              onClick={() => selectTab('p2')}
            >
              Service Plan
            </button>
            <button className="login-btn" onClick={goLogin}>
              로그인
            </button>
          </div>
        </div>
      </nav>

      {tab === 'p1' && <PageOne />}
      {tab === 'p2' && <PageTwo />}

      <footer>
        © MegazoneCloud · SpaceFlow · 2026 ·{' '}
        <a href="https://mzc-spaceflow.com/" target="_blank" rel="noopener noreferrer">
          mzc-spaceflow.com
        </a>
      </footer>
    </div>
  )
}

function PageOne() {
  return (
    <section className="page active">
      <div className="container">
        <header className="header">
          <span className="eyebrow">Requirements</span>
          <h1 className="title">
            SpaceFlow
            <span className="tagline">일잘러 영업팀을 위한 PoA 작성 자동화 플랫폼</span>
          </h1>
          <p className="lead">
            AWS 파트너사 영업·기술 담당자의 PoA 문서 작성 비효율을 제거한다.
            비정형 자료를 붙여넣으면 <strong>핵심 정보 추출 → 승인 문서 기반 초안 → 사전 Reject 감지</strong>까지 한 번에.
            최대 8일 걸리던 작업을 <strong>수 시간</strong>으로 단축한다.
          </p>
        </header>
      </div>

      {/* Problem */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">01 · Problem</div>
            <h2 className="block-title">문서 작성 과정이 비즈니스의 병목이 된다</h2>
            <p className="block-sub">AWS 파트너사 영업·기술 담당자가 PoA 문서를 작성할 때마다 겪는 비효율.</p>
          </div>

          <div className="metrics" style={{ marginBottom: 24 }}>
            <div>
              <div className="label">1건 평균</div>
              <div className="value">5일</div>
              <div className="note">Confirm 기준</div>
            </div>
            <div>
              <div className="label">Reject 포함</div>
              <div className="value">8일</div>
              <div className="note danger">+3일 재작성</div>
            </div>
            <div>
              <div className="label">연간 Reject율</div>
              <div className="value">30%</div>
              <div className="note danger">54건 중 16건</div>
            </div>
            <div>
              <div className="label">연간 누적 공수</div>
              <div className="value">318일</div>
              <div className="note danger">업무 병목</div>
            </div>
          </div>

          <div className="impact-breakdown" style={{ marginBottom: 24 }}>
            <div className="impact-breakdown-item">
              <div className="impact-breakdown-head">
                <span className="impact-breakdown-num">1</span>
                <h4>운영 효율성 측면</h4>
              </div>
              <ul className="impact-breakdown-list">
                <li><strong>대상 건수</strong> · Gen AI IC 펀딩 연간 54건</li>
                <li><strong>반려율</strong> · 약 30% (연간 16건)</li>
                <li>
                  <strong>소요 기간</strong>
                  <ul>
                    <li>정상 승인 시: 건당 5일</li>
                    <li>반려 및 재작성 시: 건당 최소 8일</li>
                  </ul>
                </li>
                <li><strong>총 기회비용(공수)</strong> · 연간 318 영업일 매몰</li>
              </ul>
            </div>
            <div className="impact-breakdown-item">
              <div className="impact-breakdown-head">
                <span className="impact-breakdown-num">2</span>
                <h4>기회비용 측면</h4>
              </div>
              <ul className="impact-breakdown-list">
                <li><strong>전체 규모</strong> · Gen AI IC 펀드 연간 54건 ($2.1M 규모)</li>
                <li><strong>환산 손실</strong> · 연간 약 30억 원 ($2.1M, 환율 1,500원 기준)</li>
                <li><strong>핵심 지표</strong> · 프로세스 병목으로 인한 연간 약 30억 규모의 기회비용 발생</li>
              </ul>
            </div>
          </div>

          <div className="callout" style={{ marginBottom: 32 }}>
            <strong>연간 318일 산식</strong> · Confirm 38건 × 5일 (190일) + Reject 16건 × 8일 (128일).
            이 시간만큼 영업이 신규 사업·추가 펀딩 발굴에 쓰지 못한다.
          </div>

          <div className="list-rows">
            {[
              { n: '01', t: '초안 작성 시간 과다', d: '1건당 평균 5일. 고객사명·요구사항·기술스택·예산을 수기로 구조화한다.' },
              { n: '02', t: 'Reject 시 재작성 +3일 · 실질 8일', d: '사전 검수 기준이 없어 제출 후 반려가 발생하면 보완 · 재제출을 반복한다.' },
              { n: '03', t: '비정형 자료 분산', d: '이메일·메모·미팅록·설계문서가 담당자별로 흩어져 있어 매번 수작업으로 취합한다.' },
              { n: '04', t: 'SOW 앞단 입력이 뒷단에 반복 수기 입력', d: 'Stakeholder · Partner · Project Team 입력 → Resource & Cost Role Rates에 다시 수동으로 복사한다.' },
              { n: '05', t: '추가 사업 기회 손실', d: '연 318일 공수가 새로운 고객 발굴·제안·펀딩 신청에 쓰이지 못해 펀딩 사이클이 지연된다.' },
            ].map(row => (
              <div key={row.n} className="list-row">
                <div className="idx">{row.n}</div>
                <div>
                  <strong>{row.t}</strong>
                  <p>{row.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">02 · Solution</div>
            <h2 className="block-title">3단계 자율 에이전트 워크플로우</h2>
            <p className="block-sub">붙여넣으면 초안이 나오고, 제출 전에 Reject를 예측한다.</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-num">STEP 01</div>
              <h4>비정형 자료 입력 → 정보 추출</h4>
              <p>
                이메일·메모·미팅록을 그대로 입력하면{' '}
                <strong>고객사명·요구사항·기술스택·예산·일정</strong>을 자동으로 구조화한다.
              </p>
            </div>
            <div className="step">
              <div className="step-num">STEP 02</div>
              <h4>승인 문서 패턴 기반 초안 생성</h4>
              <p>
                과거 승인 PoA · SOW 코퍼스를 참조해{' '}
                <strong>Executive Summary · Scope · Resource · Cost</strong> 초안을 즉시 생성한다.
              </p>
            </div>
            <div className="step">
              <div className="step-num">STEP 03</div>
              <h4>사전 Reject 감지 · 보완 제안</h4>
              <p>
                QA/QC 체크리스트로 통과 확률을 진단하고 <strong>보완 문구를 자동 제안</strong>해
                Reject 반복 사이클을 사전에 차단한다.
              </p>
            </div>
          </div>

          <div className="callout tinted" style={{ marginTop: 24 }}>
            <strong>결과</strong> · 고객 상담 후 최대 8일(Reject 포함) 걸리던 작업이 수 시간 이내에 끝난다.
            동일 인력으로 더 많은 신규 사업 · 펀딩 기회를 확보한다.
          </div>
        </div>
      </section>

      {/* Business Impact */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">03 · Business Impact</div>
            <h2 className="block-title">문서 작성 공수 · 펀딩 실행력 · 업무 확장성</h2>
          </div>

          <div className="impact">
            <div className="impact-head">
              <span className="impact-tag">IMPACT 1</span>
              <h3>문서 작성 공수</h3>
            </div>
            <div className="impact-body">
              <table>
                <thead>
                  <tr><th>항목</th><th>AS-IS</th><th>TO-BE</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>초안 작성</td>
                    <td><span className="tag-val danger">평균 5일</span></td>
                    <td><span className="tag-val ok">수 시간 이내</span></td>
                  </tr>
                  <tr>
                    <td>Reject 후 재작성</td>
                    <td><span className="tag-val danger">추가 3일</span></td>
                    <td><span className="tag-val ok">공유 드라이브 방식으로 최소화</span></td>
                  </tr>
                  <tr>
                    <td>연간 누적 공수 (54건)</td>
                    <td><span className="tag-val danger">약 318일</span></td>
                    <td><span className="tag-val ok">대폭 절감</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="impact">
            <div className="impact-head">
              <span className="impact-tag">IMPACT 2</span>
              <h3>펀딩 실행력</h3>
            </div>
            <div className="impact-body">
              <div className="flow" style={{ marginBottom: 16 }}>
                <div className="flow-col before">
                  <div className="flow-head">
                    <span className="flow-mark">AS-IS</span>
                    <h3>현재</h3>
                  </div>
                  <div className="flow-steps">
                    <div className="flow-step"><strong>Reject 반복</strong></div>
                    <div className="flow-step"><strong>영업 기회 손실</strong></div>
                    <div className="flow-step"><strong>펀딩 사이클 지연</strong></div>
                  </div>
                </div>
                <div className="flow-col after">
                  <div className="flow-head">
                    <span className="flow-mark">TO-BE</span>
                    <h3>SpaceFlow 도입 후</h3>
                  </div>
                  <div className="flow-steps">
                    <div className="flow-step"><strong>사전 Reject 감지</strong></div>
                    <div className="flow-step"><strong>승인율 향상</strong></div>
                    <div className="flow-step"><strong>기존 대비 펀딩 금액 증가로 인한 신규 영업 기회 확장</strong></div>
                  </div>
                </div>
              </div>

              <div className="metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div className="label">현재 Reject율</div>
                  <div className="value">30% · 16건</div>
                  <div className="note danger">반복 사이클</div>
                </div>
                <div>
                  <div className="label">절반 감소 시 손실 방어</div>
                  <div className="value">$315K · 4.5억</div>
                  <div className="note ok">SpaceFlow 효과</div>
                </div>
              </div>
            </div>
          </div>

          <div className="impact">
            <div className="impact-head">
              <span className="impact-tag">IMPACT 3</span>
              <h3>업무 확장성</h3>
            </div>
            <div className="impact-body">
              <div className="stack">
                <div>
                  <h4>유관 업무 확산</h4>
                  <p>
                    PoA / SOW 자동화 기반을 <strong>제안서 · RFP · 고객 보고서</strong>로 확산할 수 있다.
                  </p>
                </div>
                <div>
                  <h4>기존 파이프라인 결합</h4>
                  <p>
                    MegazoneCloud 고객 파이프라인과 결합해{' '}
                    <strong>영업 생산성을 구조적으로 개선</strong>한다.
                  </p>
                </div>
                <div>
                  <h4>SFDC 연동 시 실적 반영</h4>
                  <p>
                    펀딩 금액을 <strong>영업 실적으로 반영</strong>해 관리 효율과 동기 부여를 확보한다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key features */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">04 · Key Features</div>
            <h2 className="block-title">핵심 기능</h2>
          </div>

          <div className="feature-grid">
            <div>
              <h4>앞단 → 뒷단 자동 연동 <span className="pill">KEY</span></h4>
              <p>
                2.2 Stakeholder · Partner · Project Team 입력 →{' '}
                <strong>7. Resource & Cost의 Role Rates</strong>에 자동 주입.
                영업이 가장 시간 쓰던 반복 입력을 구조적으로 제거한다.
              </p>
            </div>
            <div>
              <h4>QA/QC — Lint for Document</h4>
              <p>
                코드 Lint가 문법·거버넌스를 잡아주듯 <strong>문서 통과 확률과 평가 기준 9개</strong>를
                제출 전 진단한다. "Reject 판정"이 아닌 "보완 권장" 어조.
              </p>
            </div>
            <div>
              <h4>승인 문서 기반 초안</h4>
              <p>
                과거 승인 PoA / SOW 코퍼스를 <strong>Bedrock Knowledge Bases (RAG)</strong>로
                참조해 섹션 단위 품질을 확보한다.
              </p>
            </div>
            <div>
              <h4>Approve / Reject Change Request</h4>
              <p>
                권한 기반으로 <strong>AS-IS / TO-BE diff</strong>를 확인하고 승인한다.
                변경 이력·근거·책임이 한눈에 보인다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">05 · Technology</div>
            <h2 className="block-title">기술 구성</h2>
          </div>

          <div className="stack">
            <div>
              <h4>Bedrock AgentCore</h4>
              <p>Parent Orchestrator + 전문 Agent(QA/QC · Resource · Architecture)의 자율 플래닝.</p>
            </div>
            <div>
              <h4>MCP + RAG</h4>
              <p>Model Context Protocol 기반 Tool 호출과 Bedrock Knowledge Bases 승인 문서 검색.</p>
            </div>
            <div>
              <h4>Lambda Serverless</h4>
              <p>사용량 기반 과금으로 유휴 비용 최소화. IAM + Guardrails로 기업 보안 요건을 충족한다.</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

function PageTwo() {
  return (
    <section className="page active">
      <div className="container">
        <header className="header">
          <span className="eyebrow">Service Plan</span>
          <h1 className="title">
            SpaceFlow
            <span className="tagline">AS-IS / TO-BE · Live App</span>
          </h1>
          <p className="lead">
            실제 MegazoneCloud 영업이 쓰는 APN PoA 문서에서 검증. 최대{' '}
            <strong>8일 → 수 시간</strong>, 연 <strong>318일 공수 절감</strong>,
            Reject 절반 감소 시 <strong>4.5억 펀딩 손실 방어</strong>.
          </p>
        </header>
      </div>

      {/* AS-IS / TO-BE */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">01 · Flow Comparison</div>
            <h2 className="block-title">AS-IS vs TO-BE</h2>
            <p className="block-sub">1건 기준 프로세스 · 연 54건 누적 공수 비교.</p>
          </div>

          <div className="flow">
            <div className="flow-col before">
              <div className="flow-head">
                <span className="flow-mark">AS-IS</span>
                <h3>최대 8일</h3>
              </div>
              <div className="flow-steps">
                <div className="flow-step">
                  <strong>자료 수집</strong>
                  <small>이메일·미팅록·메모 수작업 취합</small>
                </div>
                <div className="flow-step">
                  <strong>영업 초안 작성</strong>
                  <small>Executive Summary · Scope · SOW 수기 작성</small>
                </div>
                <div className="flow-step">
                  <strong>Role Rates 반복 입력</strong>
                  <small>앞단 정보를 뒷단에 수기 복사</small>
                </div>
                <div className="flow-step">
                  <strong>기술팀 리뷰 · 왕복</strong>
                  <small>Confirm까지 5일</small>
                </div>
                <div className="flow-loop">Reject 시 +3일 재작성 · 실질 8일</div>
              </div>
              <div className="flow-total">연 54건 누적 318일</div>
            </div>

            <div className="flow-col after">
              <div className="flow-head">
                <span className="flow-mark">TO-BE</span>
                <h3>수 시간</h3>
              </div>
              <div className="flow-steps">
                <div className="flow-step">
                  <strong>비정형 자료 Chat 입력</strong>
                  <small>메모·이메일 그대로 붙여넣기</small>
                </div>
                <div className="flow-step">
                  <strong>핵심 정보 자동 추출</strong>
                  <small>고객 · 요구사항 · 기술스택 · 예산</small>
                </div>
                <div className="flow-step">
                  <strong>승인 문서 기반 초안 · Role Rates 자동 연동</strong>
                </div>
                <div className="flow-step">
                  <strong>사전 Reject 감지 · 보완 제안</strong>
                </div>
                <div className="flow-step">
                  <strong>Approve → Export DOCX</strong>
                </div>
                <div className="flow-loop">Reject 사유 누적 → QA/QC 규칙 자동 업데이트</div>
              </div>
              <div className="flow-total">Reject 절반 감소 시 4.5억 손실 방어</div>
            </div>
          </div>

          <div className="metrics" style={{ marginTop: 24, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <div className="label">1건 리드타임</div>
              <div className="value">8일 → 수 시간</div>
              <div className="note ok">Reject 포함 기준</div>
            </div>
            <div>
              <div className="label">연 누적 공수 (54건)</div>
              <div className="value">318일 절감</div>
              <div className="note ok">신규 사업·펀딩 발굴 여력 확보</div>
            </div>
            <div>
              <div className="label">펀딩 손실 방어</div>
              <div className="value">$315K · 4.5억</div>
              <div className="note ok">Reject율 30 → 15% 시</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live app */}
      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="block-eyebrow">02 · Live App</div>
            <h2 className="block-title">실제 배포 페이지</h2>
            <p className="block-sub">AWS에 배포된 SpaceFlow 라이브 환경.</p>
          </div>

          <div className="demo-card">
            <div className="demo-bar">
              <div className="demo-url">
                <span className="demo-dots"><span></span><span></span><span></span></span>
                <span className="demo-addr">https://mzc-spaceflow.com/#/login</span>
              </div>
              <a
                href="https://mzc-spaceflow.com/#/login"
                target="_blank"
                rel="noopener noreferrer"
                className="demo-open"
              >
                Open ↗
              </a>
            </div>
            <div className="demo-frame">
              <iframe
                src="https://mzc-spaceflow.com/#/login"
                title="SpaceFlow Live"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}


const LANDING_CSS = `
  .lp-root {
    --bg: #ffffff;
    --bg-soft: #fafafa;
    --text: #0a0a0a;
    --text-muted: #6b7280;
    --text-subtle: #9ca3af;
    --border: #ececec;
    --border-strong: #d4d4d4;
    --accent: #0057ff;
    --accent-soft: #f0f5ff;
    --danger: #dc2626;
    --danger-soft: #fef2f2;
    --success: #16a34a;
    --success-soft: #f0fdf4;
    --warning: #b45309;
    --warning-soft: #fffbeb;

    background: var(--bg);
    color: var(--text);
    font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv11', 'ss01';
    min-height: 100vh;
  }
  .lp-root * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  /* Top nav */
  .lp-root .nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: saturate(1.2) blur(10px);
    -webkit-backdrop-filter: saturate(1.2) blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .lp-root .nav-inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 14px 32px;
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .lp-root .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: var(--text);
    text-decoration: none;
  }
  .lp-root .brand-mark {
    width: 28px;
    height: 28px;
    display: inline-block;
    flex-shrink: 0;
    object-fit: contain;
  }
  .lp-root .brand-sub {
    margin-left: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--bg-soft);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 11.5px;
    letter-spacing: 0.02em;
    border: 1px solid var(--border);
  }
  .lp-root .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  .lp-root .tab {
    height: 32px;
    padding: 0 12px;
    background: transparent;
    color: var(--text-muted);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    letter-spacing: -0.01em;
    transition: color .15s;
  }
  .lp-root .tab:hover { color: var(--text); }
  .lp-root .tab.active {
    color: var(--text);
    background: var(--bg-soft);
  }
  .lp-root .login-btn {
    height: 32px;
    padding: 0 14px;
    margin-left: 8px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    transition: background .15s, transform .05s;
  }
  .lp-root .login-btn:hover { background: #0047d6; }
  .lp-root .login-btn:active { transform: translateY(1px); }

  /* Page & sections */
  .lp-root .page { display: none; }
  .lp-root .page.active { display: block; }
  .lp-root .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 32px;
  }
  .lp-root .header {
    padding: 80px 0 48px;
    border-bottom: 1px solid var(--border);
  }
  .lp-root .eyebrow {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 20px;
  }
  .lp-root .title {
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: -0.035em;
    font-weight: 700;
    margin: 0 0 20px;
    color: var(--text);
  }
  .lp-root .title .tagline {
    display: block;
    font-size: 22px;
    line-height: 1.4;
    letter-spacing: -0.02em;
    font-weight: 500;
    color: var(--text-muted);
    margin-top: 10px;
  }
  .lp-root .lead {
    font-size: 17px;
    line-height: 1.6;
    color: var(--text-muted);
    max-width: 720px;
    margin: 0;
  }
  .lp-root .lead strong { color: var(--text); font-weight: 600; }

  /* Section block */
  .lp-root section.block {
    padding: 64px 0;
    border-bottom: 1px solid var(--border);
  }
  .lp-root section.block:last-of-type { border-bottom: none; }
  .lp-root .block-head { margin-bottom: 32px; }
  .lp-root .block-eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }
  .lp-root h2.block-title {
    font-size: 28px;
    line-height: 1.25;
    letter-spacing: -0.025em;
    font-weight: 600;
    margin: 6px 0 8px;
    color: var(--text);
  }
  .lp-root .block-sub {
    font-size: 15px;
    color: var(--text-muted);
    margin: 0;
    max-width: 680px;
  }

  /* Metrics row */
  .lp-root .metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg);
  }
  .lp-root .metrics > div {
    padding: 20px 22px;
    border-right: 1px solid var(--border);
  }
  .lp-root .metrics > div:last-child { border-right: none; }
  .lp-root .metrics .label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    letter-spacing: 0.02em;
    margin-bottom: 8px;
  }
  .lp-root .metrics .value {
    font-size: 26px;
    line-height: 1.1;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .lp-root .metrics .note {
    font-size: 12.5px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .lp-root .metrics .note.warn { color: var(--warning); }
  .lp-root .metrics .note.danger { color: var(--danger); }
  .lp-root .metrics .note.ok { color: var(--success); }
  @media (max-width: 760px) {
    .lp-root .metrics { grid-template-columns: repeat(2, 1fr) !important; }
    .lp-root .metrics > div:nth-child(2) { border-right: none; }
    .lp-root .metrics > div:nth-child(1),
    .lp-root .metrics > div:nth-child(2) { border-bottom: 1px solid var(--border); }
  }

  /* Callout */
  .lp-root .callout {
    padding: 18px 22px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-soft);
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
  }
  .lp-root .callout strong { font-weight: 600; }
  .lp-root .callout.tinted {
    background: var(--accent-soft);
    border-color: #dbe5ff;
    color: #1e40af;
  }
  .lp-root .callout.tinted strong { color: #1e3a8a; }

  /* Impact breakdown (Problem 추가 설명) */
  .lp-root .impact-breakdown {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 760px) { .lp-root .impact-breakdown { grid-template-columns: 1fr; } }
  .lp-root .impact-breakdown-item {
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
  }
  .lp-root .impact-breakdown-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .lp-root .impact-breakdown-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .lp-root .impact-breakdown-head h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .lp-root .impact-breakdown-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lp-root .impact-breakdown-list > li {
    position: relative;
    padding: 6px 0 6px 14px;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-muted);
  }
  .lp-root .impact-breakdown-list > li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-subtle);
  }
  .lp-root .impact-breakdown-list > li strong {
    color: var(--text);
    font-weight: 600;
    margin-right: 4px;
  }
  .lp-root .impact-breakdown-list ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0 0 0 8px;
  }
  .lp-root .impact-breakdown-list ul li {
    position: relative;
    padding: 2px 0 2px 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .lp-root .impact-breakdown-list ul li::before {
    content: '–';
    position: absolute;
    left: 0;
    color: var(--text-subtle);
  }

  /* Problem list */
  .lp-root .list-rows {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .lp-root .list-row {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 20px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border);
    align-items: baseline;
  }
  .lp-root .list-row:last-child { border-bottom: none; }
  .lp-root .list-row .idx {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
  .lp-root .list-row strong {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }
  .lp-root .list-row p {
    margin: 0;
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* Steps */
  .lp-root .steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  @media (max-width: 760px) { .lp-root .steps { grid-template-columns: 1fr; } }
  .lp-root .step {
    padding: 24px 22px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
  }
  .lp-root .step-num {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }
  .lp-root .step h4 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.015em;
    margin: 0 0 8px;
    color: var(--text);
  }
  .lp-root .step p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-muted);
  }
  .lp-root .step p strong { color: var(--text); font-weight: 600; }

  /* Impact */
  .lp-root .impact {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .lp-root .impact + .impact { margin-top: 16px; }
  .lp-root .impact-head {
    padding: 14px 22px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .lp-root .impact-tag {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 3px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .lp-root .impact-head h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .lp-root .impact-body { padding: 22px; }

  /* Table */
  .lp-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .lp-root table th, .lp-root table td {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  .lp-root table th {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-subtle);
    background: var(--bg-soft);
  }
  .lp-root table tr:last-child td { border-bottom: none; }
  .lp-root table td .tag-val {
    display: inline-block;
    font-size: 13px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-soft);
    color: var(--text);
  }
  .lp-root table td .tag-val.danger { background: var(--danger-soft); color: var(--danger); }
  .lp-root table td .tag-val.ok { background: var(--success-soft); color: var(--success); }

  /* Flow compare */
  .lp-root .flow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 760px) { .lp-root .flow { grid-template-columns: 1fr; } }
  .lp-root .flow-col {
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
  }
  .lp-root .flow-col.before { background: var(--bg-soft); }
  .lp-root .flow-col.after {
    border-color: #cfd9ee;
    background: var(--accent-soft);
  }
  .lp-root .flow-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .lp-root .flow-mark {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 3px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .lp-root .flow-col.after .flow-mark { color: var(--accent); border-color: #cfd9ee; }
  .lp-root .flow-col h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .lp-root .flow-steps {
    display: grid;
    gap: 8px;
    counter-reset: fs;
  }
  .lp-root .flow-step {
    padding: 10px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13.5px;
    line-height: 1.5;
    counter-increment: fs;
  }
  .lp-root .flow-step::before {
    content: counter(fs, decimal-leading-zero) "  ";
    font-weight: 500;
    color: var(--text-subtle);
    font-variant-numeric: tabular-nums;
  }
  .lp-root .flow-step strong { font-weight: 600; color: var(--text); }
  .lp-root .flow-step small {
    display: block;
    color: var(--text-muted);
    font-size: 12.5px;
    margin-top: 2px;
    margin-left: 28px;
  }
  .lp-root .flow-loop {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    margin-top: 4px;
  }
  .lp-root .flow-col.before .flow-loop {
    background: var(--danger-soft);
    color: var(--danger);
    border: 1px solid #fecaca;
  }
  .lp-root .flow-col.after .flow-loop {
    background: var(--bg);
    color: var(--text-muted);
    border: 1px dashed var(--border-strong);
  }
  .lp-root .flow-total {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 600;
    text-align: center;
    letter-spacing: -0.01em;
  }
  .lp-root .flow-col.before .flow-total { background: var(--bg); color: var(--danger); border: 1px solid var(--border); }
  .lp-root .flow-col.after .flow-total { background: var(--bg); color: var(--accent); border: 1px solid #cfd9ee; }

  /* Feature grid */
  .lp-root .feature-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 760px) { .lp-root .feature-grid { grid-template-columns: 1fr; } }
  .lp-root .feature-grid > div {
    padding: 22px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .lp-root .feature-grid > div:nth-child(2n) { border-right: none; }
  .lp-root .feature-grid > div:nth-last-child(-n+2) { border-bottom: none; }
  @media (max-width: 760px) {
    .lp-root .feature-grid > div { border-right: none; border-bottom: 1px solid var(--border); }
    .lp-root .feature-grid > div:last-child { border-bottom: none; }
  }
  .lp-root .feature-grid h4 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 6px;
  }
  .lp-root .feature-grid h4 .pill {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    margin-left: 6px;
    border-radius: 4px;
    background: var(--accent-soft);
    color: var(--accent);
    vertical-align: 2px;
  }
  .lp-root .feature-grid p {
    margin: 0;
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.6;
  }
  .lp-root .feature-grid p strong { color: var(--text); font-weight: 600; }

  /* Stack row */
  .lp-root .stack {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  @media (max-width: 760px) { .lp-root .stack { grid-template-columns: 1fr; } }
  .lp-root .stack > div {
    padding: 22px;
    border-right: 1px solid var(--border);
  }
  .lp-root .stack > div:last-child { border-right: none; }
  @media (max-width: 760px) {
    .lp-root .stack > div { border-right: none; border-bottom: 1px solid var(--border); }
    .lp-root .stack > div:last-child { border-bottom: none; }
  }
  .lp-root .stack h4 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  .lp-root .stack p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-muted);
  }
  .lp-root .stack p strong { color: var(--text); font-weight: 600; }

  /* Live demo embed */
  .lp-root .demo-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg);
  }
  .lp-root .demo-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
  }
  .lp-root .demo-url {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .lp-root .demo-dots {
    display: inline-flex;
    gap: 6px;
    margin-right: 4px;
  }
  .lp-root .demo-dots span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #d4d4d4;
  }
  .lp-root .demo-dots span:nth-child(1) { background: #ff5f57; }
  .lp-root .demo-dots span:nth-child(2) { background: #febc2e; }
  .lp-root .demo-dots span:nth-child(3) { background: #28c840; }
  .lp-root .demo-addr {
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 12.5px;
    color: var(--text-muted);
    background: var(--bg);
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .lp-root .demo-open {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text);
    text-decoration: none;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    transition: background .15s;
    white-space: nowrap;
    margin-left: 10px;
  }
  .lp-root .demo-open:hover { background: var(--bg-soft); }
  .lp-root .demo-frame {
    position: relative;
    width: 100%;
    height: 720px;
    background: var(--bg);
  }
  .lp-root .demo-frame iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  /* Footer */
  .lp-root footer {
    padding: 32px;
    text-align: center;
    color: var(--text-subtle);
    font-size: 12.5px;
    border-top: 1px solid var(--border);
  }
  .lp-root footer a { color: var(--text-muted); text-decoration: none; }
  .lp-root footer a:hover { color: var(--text); }
`
