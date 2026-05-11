import { useState, useEffect } from 'react'
import { color } from '../styles/tokens'
import { useDocumentStore, type AgentStatus } from '../store/documentStore'
import { useCurrentDocAccess } from '../store/sessionStore'
import { requestExport, getDocument } from '../utils/api'
import { reconnectAppSync } from '../utils/appsync'
import { ShareModal } from './ShareModal'
import { CoverSection } from './sections/CoverSection'
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection'
import { StakeholdersSection } from './sections/StakeholdersSection'
import { SuccessCriteriaSection } from './sections/SuccessCriteriaSection'
import { AssumptionsSection } from './sections/AssumptionsSection'
import { ScopeOfWorkSection } from './sections/ScopeOfWorkSection'
import { ArchitectureSection } from './sections/ArchitectureSection'
import { MilestonesSection } from './sections/MilestonesSection'
import { CostBreakdownSection } from './sections/CostBreakdownSection'
import { ResourcesCostEstimatesSection } from './sections/ResourcesCostEstimatesSection'
import { AcceptanceSection } from './sections/AcceptanceSection'
import { LangProvider, type DocLang } from './LangContext'
import { ReviewDrawer } from './panels/ReviewDrawer'

const TABS = [
  '1. Cover',
  '2.1 Executive Summary',
  '2.2 Stakeholders',
  '2.3 Project Success Criteria',
  '2.4 Assumptions & Risks',
  '3. Scope of Work',
  '4. Architecture',
  '5. Milestones',
  '5.1 Expected AWS Cost Breakdown',
  '6. Acceptance',
  '7. Resources & Cost Estimates',
] as const

type TabName = typeof TABS[number]

const TAB_COMPONENTS: Record<TabName, React.FC> = {
  '1. Cover': CoverSection,
  '2.1 Executive Summary': ExecutiveSummarySection,
  '2.2 Stakeholders': StakeholdersSection,
  '2.3 Project Success Criteria': SuccessCriteriaSection,
  '2.4 Assumptions & Risks': AssumptionsSection,
  '3. Scope of Work': ScopeOfWorkSection,
  '4. Architecture': ArchitectureSection,
  '5. Milestones': MilestonesSection,
  '5.1 Expected AWS Cost Breakdown': CostBreakdownSection,
  '6. Acceptance': AcceptanceSection,
  '7. Resources & Cost Estimates': ResourcesCostEstimatesSection,
}

export function DocumentPanel({ docId }: { docId: string }) {
  const [activeTab, setActiveTab] = useState<TabName>('1. Cover')
  const completionScore = useDocumentStore(s => s.completion_score ?? 0)
  const blockingIssues = useDocumentStore(s => s.blocking_issues ?? [])
  const setDocument = useDocumentStore(s => s.setDocument)
  const [lang, setLang] = useState<DocLang>('ko')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  // Load document data when docId changes
  useEffect(() => {
    let cancelled = false
    getDocument(docId).then(doc => {
      if (!cancelled && doc) setDocument(doc)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [docId, setDocument])

  return (
    <LangProvider value={lang}>
      <div style={{ display: 'flex', height: '100%', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Header
            completionScore={completionScore}
            blockingIssues={blockingIssues}
            docId={docId}
            lang={lang}
            onLangChange={setLang}
            drawerOpen={drawerOpen}
            onToggleDrawer={() => {
              setDrawerOpen(prev => !prev)
            }}
          />
          <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />
          <div style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', padding: 16 }}>
            <ActiveComponent />
          </div>
        </div>

        {drawerOpen && (
          <ReviewDrawer
            docId={docId}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </div>
    </LangProvider>
  )
}

/* --- Agent Status Badge --- */

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#16A34A',
  processing: '#f59e0b',
  error: '#DC2626',
  degraded: '#f97316',
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  processing: 'Running',
  error: 'Error',
  degraded: 'Degraded',
}

function AgentStatusBadge() {
  const agentStatus = useDocumentStore(s => s.agentStatus)
  const appsyncConnected = useDocumentStore(s => s.appsyncConnected)
  const dotColor = STATUS_COLORS[agentStatus] || STATUS_COLORS.idle
  const label = STATUS_LABELS[agentStatus] || 'Idle'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: color.textSecondary }}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          animation: agentStatus === 'processing' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontWeight: 500 }}>{label}</span>
      {!appsyncConnected && (
        <>
          <span style={{ fontSize: 11, color: '#f59e0b', whiteSpace: 'nowrap' }}>
            ⚠ 실시간 연결 대기 중
          </span>
          <button
            onClick={() => reconnectAppSync()}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              border: `1px solid ${color.border}`,
              borderRadius: 4,
              background: color.bgSurface,
              color: color.textSecondary,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="AppSync WebSocket 즉시 재연결"
          >
            재연결
          </button>
        </>
      )}
    </div>
  )
}

function Header({
  completionScore, blockingIssues, docId, lang, onLangChange,
  drawerOpen, onToggleDrawer,
}: {
  completionScore: number
  blockingIssues: any[]
  docId: string
  lang: DocLang
  onLangChange: (l: DocLang) => void
  drawerOpen: boolean
  onToggleDrawer: () => void
}) {
  const exportEnabled = blockingIssues.length === 0
  const docTitle = useDocumentStore(s => (s as any).title || '')
  const { shared, role } = useCurrentDocAccess()
  const [shareOpen, setShareOpen] = useState(false)
  const isOwner = !shared && role === 'master'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${color.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }} title={docTitle}>
          {docTitle || 'APN PoC Project Plan'}
        </span>
        {shared && (
          <span
            title={role === 'edit' ? '편집 가능' : '읽기 전용'}
            style={{
              fontSize: 10, fontWeight: 600,
              background: '#e0e7ff', color: '#3730a3',
              padding: '2px 6px', borderRadius: 4,
            }}
          >
            공유받은 문서 · {role === 'edit' ? '편집' : '읽기'}
          </span>
        )}
        <CompletionBadge score={completionScore} />
        <AgentStatusBadge />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <LangToggle lang={lang} onChange={onLangChange} />
        <ReviewToggleButton open={drawerOpen} onClick={() => onToggleDrawer()} />
        {isOwner && (
          <ShareButton onClick={() => setShareOpen(true)} />
        )}
        <ExportButton disabled={!exportEnabled} docId={docId} />
      </div>
      <ShareModal
        open={shareOpen}
        docId={docId}
        docTitle={docTitle}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}

/** 공유 버튼 — owner만 노출 */
function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="다른 사용자에게 문서 공유"
      className="mzc-btn"
      style={{
        fontSize: 13, padding: '6px 12px',
        background: 'white',
        border: `1px solid ${color.border}`,
        borderRadius: 6, color: color.textPrimary, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      <span style={{ fontSize: 13 }}>🔗</span>
      공유
    </button>
  )
}

/** Completion score badge: 0.0~1.0 displayed as percentage with color coding */
export function CompletionBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const bg = pct >= 100 ? color.success : pct >= 50 ? '#f59e0b' : color.error
  return (
    <span
      style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: color.bgSurface, background: bg }}
      role="status"
      aria-label={`Completion: ${pct}%`}
    >
      {pct}%
    </span>
  )
}

/** Export button: enabled only when blocking_issues is empty */
function ExportButton({ disabled, docId }: { disabled: boolean; docId: string }) {
  const handleExport = async () => {
    if (disabled) return
    try {
      const result = await requestExport(docId)
      if (result?.download_url) {
        window.open(result.download_url, '_blank')
      }
    } catch {
      // Error handled by status channel
    }
  }

  return (
    <button
      disabled={disabled}
      onClick={handleExport}
      title={disabled ? 'Blocking issues가 해결되어야 export 가능합니다' : 'DOCX 파일로 내보내기'}
      className="mzc-btn mzc-btn-primary"
      style={{ fontSize: 13 }}
    >
      Export DOCX
    </button>
  )
}

function ReviewToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Submission Readiness"
      className={`mzc-btn ${open ? 'mzc-btn-primary' : 'mzc-btn-secondary'}`}
      style={{ fontSize: 13 }}
    >
      {open ? '✕ Review' : 'Run Review'}
    </button>
  )
}

function LangToggle({ lang, onChange }: { lang: DocLang; onChange: (l: DocLang) => void }) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, border: `1px solid ${color.border}`, overflow: 'hidden', fontSize: 12 }}>
      <button
        onClick={() => onChange('ko')}
        style={{
          padding: '4px 10px', border: 'none', cursor: 'pointer',
          background: lang === 'ko' ? color.mzNavy : color.bgSurface,
          color: lang === 'ko' ? color.bgSurface : color.textSecondary,
          fontWeight: lang === 'ko' ? 600 : 400,
        }}
      >한글</button>
      <button
        onClick={() => onChange('en')}
        style={{
          padding: '4px 10px', border: 'none', cursor: 'pointer',
          background: lang === 'en' ? color.mzNavy : color.bgSurface,
          color: lang === 'en' ? color.bgSurface : color.textSecondary,
          fontWeight: lang === 'en' ? 600 : 400,
        }}
      >ENG</button>
    </div>
  )
}

function TabBar({ tabs, active, onSelect }: { tabs: readonly string[]; active: string; onSelect: (t: any) => void }) {
  return (
    <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${color.border}`, padding: '0 8px' }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: active === t ? 600 : 400, whiteSpace: 'nowrap',
            borderBottom: active === t ? `2px solid ${color.mzRed}` : '2px solid transparent',
            color: active === t ? color.mzRed : color.textSecondary,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
