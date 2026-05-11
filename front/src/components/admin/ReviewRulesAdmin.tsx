import { useEffect, useMemo, useState } from 'react'
import { color } from '../../styles/tokens'
import {
  collectCategories,
  type EvaluationType,
  type RuleDefinition,
  type RuleSeverity,
} from '../../constants/reviewRulesSeed'
import {
  createCustomRule,
  deleteCustomRule,
  listReviewRules,
  setRuleEnabled,
  updateCustomRule,
} from '../../utils/reviewRulesApi'
import { useDocLang } from '../LangContext'
import {
  IconAlert,
  IconArrowLeft,
  IconBook,
  IconCheck,
  IconCircleDot,
  IconEdit,
  IconFilter,
  IconInfo,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
  IconTag,
  IconTrash,
  IconX,
} from './icons'

type EnabledFilter = 'ALL' | 'ENABLED' | 'DISABLED'
type CustomFilter = 'ALL' | 'CUSTOM' | 'BUILTIN'

const SEVERITIES: RuleSeverity[] = ['Critical', 'High', 'Medium', 'Low', 'Info']
const EVAL_TYPES: EvaluationType[] = ['static', 'llm', 'hybrid']

/**
 * Maps English category names to CSS class suffixes that drive the
 * `--cat-color` accent used by sidebar dots and category pills.
 */
function catClassFor(categoryEn: string): string {
  const k = categoryEn.toLowerCase()
  if (k.includes('apfp')) return 'cat-c-apfp'
  if (k.includes('arr')) return 'cat-c-awsarr'
  if (k.includes('architect')) return 'cat-c-architecture'
  if (k.includes('business')) return 'cat-c-business'
  if (k.includes('deploy')) return 'cat-c-deployment'
  if (k.includes('final')) return 'cat-c-final'
  if (k.includes('fund')) return 'cat-c-funding'
  if (k.includes('genai')) return 'cat-c-genai'
  if (k.includes('production')) return 'cat-c-production'
  if (k.includes('risk')) return 'cat-c-risk'
  if (k.includes('sow cost') || k.includes('sowcost')) return 'cat-c-sowcost'
  if (k.includes('scope')) return 'cat-c-scope'
  if (k.includes('success')) return 'cat-c-success'
  if (k.includes('use case')) return 'cat-c-usecase'
  return 'cat-c-default'
}

/**
 * Review Rules Admin — "리뷰 규칙 관리" page. Lists built-in and custom
 * rules, lets operators enable/disable rules, edit custom rules, and add
 * new custom rules. Falls back to a read-only seeded catalog when the
 * backend `/review_rules` endpoint is not deployed.
 */
export function ReviewRulesAdmin({ onClose }: { onClose?: () => void }) {
  const lang = useDocLang()
  const [rules, setRules] = useState<RuleDefinition[]>([])
  const [version, setVersion] = useState<string>('')
  const [sourceDocs, setSourceDocs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fromFallback, setFromFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<RuleSeverity | 'ALL'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [customFilter, setCustomFilter] = useState<CustomFilter>('ALL')
  const [search, setSearch] = useState('')

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState<RuleDefinition | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReviewRules()
      setRules(data.rules)
      setVersion(data.version || '')
      setSourceDocs(data.source_documents || [])
      setFromFallback(!!data.fromFallback)
    } catch (e: any) {
      setError(e?.message || 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const categories = useMemo(() => collectCategories(rules), [rules])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rules.filter(r => {
      if (enabledFilter === 'ENABLED' && !r.enabled) return false
      if (enabledFilter === 'DISABLED' && r.enabled) return false
      if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false
      if (categoryFilter !== 'ALL' && r.category_en !== categoryFilter) return false
      if (customFilter === 'CUSTOM' && !r.custom) return false
      if (customFilter === 'BUILTIN' && r.custom) return false
      if (q) {
        const hay = [
          r.rule_id, r.title_kr, r.title_en, r.description_kr, r.description_en,
          r.category_kr, r.category_en, r.source,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rules, enabledFilter, severityFilter, categoryFilter, customFilter, search])

  const counts = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    custom: rules.filter(r => r.custom).length,
    critical: rules.filter(r => r.severity === 'Critical').length,
  }), [rules])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    rules.forEach(r => m.set(r.category_en, (m.get(r.category_en) || 0) + 1))
    return m
  }, [rules])

  const handleToggleEnabled = async (rule: RuleDefinition) => {
    const next = !rule.enabled
    setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: next } : r))
    try {
      await setRuleEnabled(rule.rule_id, next)
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle rule')
      setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: !next } : r))
    }
  }

  const handleDelete = async (rule: RuleDefinition) => {
    if (!rule.custom) return
    if (!confirm(lang === 'ko' ? `커스텀 규칙 "${rule.title_kr}"을(를) 삭제하시겠습니까?` : `Delete custom rule "${rule.title_en}"?`)) return
    try {
      await deleteCustomRule(rule.rule_id)
      await reload()
      if (selectedRuleId === rule.rule_id) setSelectedRuleId(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete rule')
    }
  }

  const handleSaveCustom = async (rule: RuleDefinition, isEdit: boolean) => {
    if (isEdit) await updateCustomRule(rule.rule_id, rule)
    else await createCustomRule(rule)
    setAddOpen(false)
    setEditOpen(null)
    await reload()
  }

  const selected = rules.find(r => r.rule_id === selectedRuleId) || null

  const hasActiveFilters = enabledFilter !== 'ALL' || severityFilter !== 'ALL'
    || categoryFilter !== 'ALL' || customFilter !== 'ALL' || search.trim() !== ''

  const clearFilters = () => {
    setEnabledFilter('ALL')
    setSeverityFilter('ALL')
    setCategoryFilter('ALL')
    setCustomFilter('ALL')
    setSearch('')
  }

  return (
    <div className="admin-root">
      {/* Dark navy topbar */}
      <div className="admin-topbar">
        <div className="brand">
          <div className="brand-icon">
            <IconShieldCheck size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-title">Review Rules Admin · 리뷰 규칙 관리</div>
            <div className="brand-sub">
              <span>AWS Fund & GenAI IC 규칙 카탈로그</span>
              {version && (<><span className="dot" /><span>v{version}</span></>)}
              {sourceDocs.length > 0 && (
                <>
                  <span className="dot" />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconBook size={11} /> {sourceDocs.length} source{sourceDocs.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setAddOpen(true)}
            className="mzc-btn mzc-btn-primary"
            style={{ fontSize: 13 }}
          >
            <IconPlus size={14} /> Add Custom Rule
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="mzc-btn mzc-btn-secondary"
              style={{ fontSize: 13 }}
            >
              <IconArrowLeft size={14} /> Documents
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="admin-stats-row">
        <StatCard kind="total" label="Total Rules" value={counts.total} hint="카탈로그 전체" icon={<IconShieldCheck size={15} />} />
        <StatCard kind="enabled" label="Enabled" value={counts.enabled} hint={`${Math.round((counts.enabled / Math.max(1, counts.total)) * 100)}% active`} icon={<IconCheck size={15} />} />
        <StatCard kind="custom" label="Custom Rules" value={counts.custom} hint="팀에서 추가" icon={<IconSparkles size={15} />} />
        <StatCard kind="critical" label="Critical" value={counts.critical} hint="Must-pass checks" icon={<IconAlert size={15} />} />
      </div>

      {/* Fallback notice */}
      {fromFallback && (
        <div style={{
          padding: '10px 24px', background: color.infoSoft, color: '#1e3a8a',
          borderBottom: `1px solid #bfdbfe`, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <IconInfo size={14} />
          Rule Admin API is not available yet. Showing local fallback rule catalog.
          <span style={{ color: color.textMuted }}>변경사항은 로컬(브라우저)에만 저장됩니다.</span>
        </div>
      )}
      {error && (
        <div style={{
          padding: '10px 24px', background: color.errorSoft, color: '#991b1b',
          borderBottom: `1px solid #fecaca`, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <IconAlert size={14} /> {error}
        </div>
      )}

      {/* Main body: sidebar + main */}
      <div className="admin-body">
        {/* Left sidebar — categories */}
        <aside className="admin-sidebar">
          <div className="sidebar-label">
            <span>Categories</span>
            <span style={{ fontSize: 10, color: color.textMuted }}>{categories.length}</span>
          </div>
          <button
            className={`cat-item cat-c-default ${categoryFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setCategoryFilter('ALL')}
          >
            <span className="cat-dot" />
            <span className="cat-label">All categories</span>
            <span className="cat-count">{rules.length}</span>
          </button>
          {categories.map(c => (
            <button
              key={c.key}
              className={`cat-item ${catClassFor(c.key)} ${categoryFilter === c.key ? 'is-active' : ''}`}
              onClick={() => setCategoryFilter(c.key)}
              title={c.en}
            >
              <span className="cat-dot" />
              <span className="cat-label">{lang === 'ko' ? c.kr : c.en}</span>
              <span className="cat-count">{categoryCounts.get(c.key) || 0}</span>
            </button>
          ))}
        </aside>

        {/* Main column */}
        <section className="admin-main">
          {/* Toolbar */}
          <div className="admin-toolbar">
            <div className="filter-label">
              <IconFilter size={12} /> Filters
            </div>
            <select className="mzc-select" value={enabledFilter} onChange={e => setEnabledFilter(e.target.value as EnabledFilter)} style={{ width: 150 }}>
              <option value="ALL">상태: 전체</option>
              <option value="ENABLED">활성화만</option>
              <option value="DISABLED">비활성화만</option>
            </select>
            <select className="mzc-select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value as any)} style={{ width: 150 }}>
              <option value="ALL">Severity: 전체</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="mzc-select" value={customFilter} onChange={e => setCustomFilter(e.target.value as CustomFilter)} style={{ width: 150 }}>
              <option value="ALL">출처: 전체</option>
              <option value="BUILTIN">Built-in</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <div className="search-wrap">
              <IconSearch size={14} />
              <input
                className="mzc-input"
                placeholder="Search rules by title, id, or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <button className="active-filter-chip" onClick={clearFilters} title="모든 필터 초기화">
                {filtered.length}/{rules.length}
                <button>
                  <IconX size={11} />
                </button>
              </button>
            )}
          </div>

          {/* Table area */}
          <div className="admin-table-scroll">
            {loading && rules.length === 0 ? (
              <div style={{ padding: 48, color: color.textMuted, fontSize: 13, textAlign: 'center' }}>
                Loading rules...
              </div>
            ) : (
              <div className="admin-table-card">
                <table className="mzc-table review-admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Status</th>
                      <th style={{ width: 100 }}>Severity</th>
                      <th style={{ width: 180 }}>Category</th>
                      <th>Rule</th>
                      <th style={{ width: 90 }}>Type</th>
                      <th style={{ width: 200 }}>Source</th>
                      <th style={{ width: 80 }}>Origin</th>
                      <th style={{ width: 110 }}>Updated</th>
                      <th style={{ width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr
                        key={r.rule_id}
                        className={[
                          selectedRuleId === r.rule_id ? 'is-selected' : '',
                          r.enabled ? '' : 'is-disabled',
                        ].join(' ').trim()}
                        onClick={() => setSelectedRuleId(r.rule_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <label className="mzc-switch" title={r.enabled ? 'Disable rule' : 'Enable rule'}>
                            <input
                              type="checkbox"
                              checked={!!r.enabled}
                              onChange={() => handleToggleEnabled(r)}
                            />
                            <span className="track" />
                          </label>
                        </td>
                        <td><span className={`severity-badge ${r.severity.toLowerCase()}`}>{r.severity}</span></td>
                        <td>
                          <span className={`cat-pill ${catClassFor(r.category_en)}`}>
                            {lang === 'ko' ? r.category_kr : r.category_en}
                          </span>
                        </td>
                        <td>
                          <div className="admin-rule-title">
                            <div className="kr">{r.title_kr}</div>
                            <div className="en">{r.title_en}</div>
                            <code className="rule-id">{r.rule_id}</code>
                          </div>
                        </td>
                        <td>
                          <span className={`eval-badge ${r.evaluation_type}`}>
                            {r.evaluation_type === 'llm' && <IconSparkles size={10} />}
                            {r.evaluation_type === 'hybrid' && <IconCircleDot size={10} />}
                            {r.evaluation_type}
                          </span>
                        </td>
                        <td>
                          <div className="admin-source-list">
                            {r.source.split(/\s*\/\s*/).filter(Boolean).map((src, i) => (
                              <span key={i} className="src-chip" title={src}>{src}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`origin-badge ${r.custom ? 'custom' : 'builtin'}`}>
                            {r.custom ? <><IconSparkles size={10} /> custom</> : 'built-in'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11.5, color: color.textMuted }}>
                          {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {r.custom ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="mzc-icon-btn is-primary" title="Edit rule" onClick={() => setEditOpen(r)}>
                                <IconEdit size={14} />
                              </button>
                              <button className="mzc-icon-btn is-danger" title="Delete rule" onClick={() => handleDelete(r)}>
                                <IconTrash size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: color.textMuted }}>read-only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: color.textMuted, fontSize: 13 }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <IconSearch size={28} />
                          <div>필터에 맞는 규칙이 없습니다</div>
                          {hasActiveFilters && (
                            <button className="mzc-btn mzc-btn-secondary" onClick={clearFilters} style={{ fontSize: 12 }}>
                              필터 초기화
                            </button>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right detail drawer */}
        {selected && (
          <RuleDetailDrawer
            rule={selected}
            lang={lang}
            onClose={() => setSelectedRuleId(null)}
            onEdit={selected.custom ? () => setEditOpen(selected) : undefined}
          />
        )}
      </div>

      {/* Add / edit modal */}
      {(addOpen || editOpen) && (
        <RuleFormModal
          initial={editOpen || undefined}
          isEdit={!!editOpen}
          onCancel={() => { setAddOpen(false); setEditOpen(null) }}
          onSave={rule => handleSaveCustom(rule, !!editOpen)}
        />
      )}
    </div>
  )
}

/* ---------- Stat card ---------- */

function StatCard({
  kind, label, value, hint, icon,
}: {
  kind: 'total' | 'enabled' | 'custom' | 'critical'
  label: string
  value: number
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div className={`stat-card is-${kind}`}>
      <div className="stat-head">
        <div className="stat-label">{label}</div>
        <div className="stat-icon">{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  )
}

/* ---------- Detail drawer ---------- */

function RuleDetailDrawer({
  rule, lang, onClose, onEdit,
}: {
  rule: RuleDefinition
  lang: 'ko' | 'en'
  onClose: () => void
  onEdit?: () => void
}) {
  return (
    <div className="admin-detail-drawer">
      <div className="drawer-head">
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #eaf2ff 0%, #f5f0ff 100%)',
            color: color.primary,
            border: '1px solid rgba(59, 130, 246, 0.18)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconInfo size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: color.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lang === 'ko' ? rule.title_kr : rule.title_en}
            </div>
            <code style={{ fontSize: 10.5, color: color.textMuted, fontFamily: 'var(--mzc-font-mono)' }}>{rule.rule_id}</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onEdit && (
            <button className="mzc-icon-btn is-primary" title="Edit rule" onClick={onEdit}>
              <IconEdit size={14} />
            </button>
          )}
          <button onClick={onClose} className="mzc-icon-btn" title="Close">
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div className="drawer-body">
        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className={`severity-badge ${rule.severity.toLowerCase()}`}>{rule.severity}</span>
          <span className={`eval-badge ${rule.evaluation_type}`}>
            {rule.evaluation_type === 'llm' && <IconSparkles size={10} />}
            {rule.evaluation_type === 'hybrid' && <IconCircleDot size={10} />}
            {rule.evaluation_type}
          </span>
          <span className={`cat-pill ${catClassFor(rule.category_en)}`}>
            {lang === 'ko' ? rule.category_kr : rule.category_en}
          </span>
          <span className={`origin-badge ${rule.custom ? 'custom' : 'builtin'}`}>
            {rule.custom ? <><IconSparkles size={10} /> custom</> : 'built-in'}
          </span>
        </div>

        <DrawerBlock label="설명 / Description">
          <div className="body-kr">{rule.description_kr}</div>
          <div className="body-en">{rule.description_en}</div>
        </DrawerBlock>

        <DrawerBlock label="Related sections" icon={<IconTag size={10} />}>
          {rule.related_sections.length === 0
            ? <span style={{ fontSize: 11, color: color.textMuted }}>—</span>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {rule.related_sections.map(s => <span key={s} className="mzc-badge"><IconTag size={9} />{s}</span>)}
              </div>}
        </DrawerBlock>

        <DrawerBlock label="PASS criteria" kind="pass" icon={<IconCheck size={10} />}>
          <BilingualList kr={rule.pass_criteria_kr} en={rule.pass_criteria_en} />
        </DrawerBlock>
        <DrawerBlock label="WARNING criteria" kind="warn" icon={<IconAlert size={10} />}>
          <BilingualList kr={rule.warning_criteria_kr} en={rule.warning_criteria_en} />
        </DrawerBlock>
        <DrawerBlock label="FAIL criteria" kind="fail" icon={<IconAlert size={10} />}>
          <BilingualList kr={rule.fail_criteria_kr} en={rule.fail_criteria_en} />
        </DrawerBlock>

        <DrawerBlock label="Recommendation" icon={<IconSparkles size={10} />}>
          <div className="body-kr">{rule.recommendation_template_kr}</div>
          <div className="body-en">{rule.recommendation_template_en}</div>
        </DrawerBlock>

        <DrawerBlock label="Source" icon={<IconBook size={10} />}>
          <div className="body-kr">{rule.source}</div>
        </DrawerBlock>
      </div>
    </div>
  )
}

function DrawerBlock({
  label, icon, kind, children,
}: {
  label: string
  icon?: React.ReactNode
  kind?: 'pass' | 'warn' | 'fail'
  children: React.ReactNode
}) {
  return (
    <div className={`drawer-block ${kind || ''}`}>
      <div className="kv-label">
        {icon}{label}
      </div>
      <div>{children}</div>
    </div>
  )
}

function BilingualList({ kr, en }: { kr: string[]; en: string[] }) {
  const hasAny = (kr && kr.length > 0) || (en && en.length > 0)
  if (!hasAny) return <span style={{ fontSize: 11, color: color.textMuted }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(kr || []).map((v, i) => (
        <div key={`kr-${i}`} style={{ fontSize: 12.5, lineHeight: 1.5 }}>· {v}</div>
      ))}
      {(en || []).map((v, i) => (
        <div key={`en-${i}`} style={{ fontSize: 11.5, color: color.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>· {v}</div>
      ))}
    </div>
  )
}

/* ---------- Add / Edit form modal ---------- */

function RuleFormModal({
  initial, isEdit, onCancel, onSave,
}: {
  initial?: RuleDefinition
  isEdit: boolean
  onCancel: () => void
  onSave: (rule: RuleDefinition) => void | Promise<void>
}) {
  const [draft, setDraft] = useState<RuleDefinition>(initial || emptyRule())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const update = (patch: Partial<RuleDefinition>) => setDraft(prev => ({ ...prev, ...patch }))

  const updateList = (key: keyof RuleDefinition, raw: string) => {
    const items = raw.split('\n').map(s => s.trim()).filter(Boolean)
    setDraft(prev => ({ ...prev, [key]: items } as RuleDefinition))
  }

  const updateSections = (raw: string) => {
    const items = raw.split(',').map(s => s.trim()).filter(Boolean)
    setDraft(prev => ({ ...prev, related_sections: items }))
  }

  const handleSubmit = async () => {
    setErr(null)
    if (!draft.rule_id || !/^[a-zA-Z0-9_\-]+$/.test(draft.rule_id)) {
      setErr('rule_id는 영문/숫자/언더스코어/하이픈만 사용하세요.')
      return
    }
    if (!draft.title_kr && !draft.title_en) {
      setErr('제목(한글 또는 영문)을 입력하세요.')
      return
    }
    if (!draft.category_kr || !draft.category_en) {
      setErr('카테고리(KR/EN)를 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...draft, custom: true, enabled: true })
    } catch (e: any) {
      setErr(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mzc-modal-backdrop" onClick={onCancel}>
      <div
        className="mzc-modal"
        style={{ width: 'min(860px, 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mzc-modal-header">
          <div className="title-wrap">
            <div className="title-icon">
              {isEdit ? <IconEdit size={20} /> : <IconPlus size={22} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="title-text">
                {isEdit ? 'Edit Custom Rule' : 'Add Custom Rule'}
              </div>
              <div className="title-sub">
                {isEdit ? '커스텀 규칙을 수정합니다' : '새로운 커스텀 리뷰 규칙을 추가합니다'}
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="mzc-icon-btn" title="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="mzc-modal-body">
          {/* Section 1: Identification */}
          <div className="form-section">
            <div className="section-head">
              <div className="section-icon"><IconTag size={16} /></div>
              <div>
                <div className="section-title">Identification</div>
                <div className="section-desc">고유 ID와 카테고리를 지정하세요</div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field span-2">
                <label>rule_id <span className="req">*</span></label>
                <input className="mzc-input" value={draft.rule_id} disabled={isEdit}
                  onChange={e => update({ rule_id: e.target.value })}
                  placeholder="e.g. custom_latency_target" />
                <div className="hint">영문/숫자/언더스코어/하이픈만 사용. 저장 후 변경 불가.</div>
              </div>
              <div className="form-field">
                <label>카테고리 (KR) <span className="req">*</span></label>
                <input className="mzc-input" value={draft.category_kr} onChange={e => update({ category_kr: e.target.value })} placeholder="예: 프로덕션 사용량" />
              </div>
              <div className="form-field">
                <label>Category (EN) <span className="req">*</span></label>
                <input className="mzc-input" value={draft.category_en} onChange={e => update({ category_en: e.target.value })} placeholder="e.g. Production Usage" />
              </div>
            </div>
          </div>

          {/* Section 2: Content */}
          <div className="form-section">
            <div className="section-head">
              <div className="section-icon"><IconBook size={16} /></div>
              <div>
                <div className="section-title">Content</div>
                <div className="section-desc">제목과 설명을 한글/영문으로 입력하세요</div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>제목 (KR) <span className="req">*</span></label>
                <input className="mzc-input" value={draft.title_kr} onChange={e => update({ title_kr: e.target.value })} placeholder="예: Bedrock Token 가정이 문서화되었는가" />
              </div>
              <div className="form-field">
                <label>Title (EN)</label>
                <input className="mzc-input" value={draft.title_en} onChange={e => update({ title_en: e.target.value })} placeholder="e.g. Bedrock token assumptions are documented" />
              </div>
              <div className="form-field span-2">
                <label>설명 (KR)</label>
                <textarea className="mzc-textarea" rows={3} value={draft.description_kr} onChange={e => update({ description_kr: e.target.value })} placeholder="규칙이 확인하고자 하는 내용을 간단히 설명하세요" />
              </div>
              <div className="form-field span-2">
                <label>Description (EN)</label>
                <textarea className="mzc-textarea" rows={3} value={draft.description_en} onChange={e => update({ description_en: e.target.value })} placeholder="English description for this rule" />
              </div>
            </div>
          </div>

          {/* Section 3: Classification */}
          <div className="form-section">
            <div className="section-head">
              <div className="section-icon"><IconSettings size={16} /></div>
              <div>
                <div className="section-title">Classification</div>
                <div className="section-desc">심각도, 평가 방식, 관련 섹션</div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>Severity</label>
                <select className="mzc-select" value={draft.severity} onChange={e => update({ severity: e.target.value as RuleSeverity })}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Evaluation Type</label>
                <select className="mzc-select" value={draft.evaluation_type} onChange={e => update({ evaluation_type: e.target.value as EvaluationType })}>
                  {EVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="hint">static: 규칙 기반, llm: AI 평가, hybrid: 둘 다</div>
              </div>
              <div className="form-field span-2">
                <label>Related sections</label>
                <input className="mzc-input"
                  value={draft.related_sections.join(', ')}
                  onChange={e => updateSections(e.target.value)}
                  placeholder="e.g. cost_breakdown, architecture" />
                <div className="hint">쉼표로 구분. 규칙이 검사하는 문서 섹션 키.</div>
              </div>
            </div>
          </div>

          {/* Section 4: Criteria */}
          <div className="form-section">
            <div className="section-head">
              <div className="section-icon"><IconShieldCheck size={16} /></div>
              <div>
                <div className="section-title">Evaluation criteria</div>
                <div className="section-desc">한 줄에 하나씩, PASS / WARNING / FAIL 기준 입력</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="criteria-col pass">
                <div className="col-head"><IconCheck size={11} /> PASS</div>
                <div className="form-field" style={{ gap: 8 }}>
                  <textarea className="mzc-textarea" rows={3} value={draft.pass_criteria_kr.join('\n')} onChange={e => updateList('pass_criteria_kr', e.target.value)} placeholder="KR 기준 (줄바꿈)" />
                  <textarea className="mzc-textarea" rows={3} value={draft.pass_criteria_en.join('\n')} onChange={e => updateList('pass_criteria_en', e.target.value)} placeholder="EN criteria (lines)" />
                </div>
              </div>
              <div className="criteria-col warn">
                <div className="col-head"><IconAlert size={11} /> WARNING</div>
                <div className="form-field" style={{ gap: 8 }}>
                  <textarea className="mzc-textarea" rows={3} value={draft.warning_criteria_kr.join('\n')} onChange={e => updateList('warning_criteria_kr', e.target.value)} placeholder="KR 기준 (줄바꿈)" />
                  <textarea className="mzc-textarea" rows={3} value={draft.warning_criteria_en.join('\n')} onChange={e => updateList('warning_criteria_en', e.target.value)} placeholder="EN criteria (lines)" />
                </div>
              </div>
              <div className="criteria-col fail">
                <div className="col-head"><IconAlert size={11} /> FAIL</div>
                <div className="form-field" style={{ gap: 8 }}>
                  <textarea className="mzc-textarea" rows={3} value={draft.fail_criteria_kr.join('\n')} onChange={e => updateList('fail_criteria_kr', e.target.value)} placeholder="KR 기준 (줄바꿈)" />
                  <textarea className="mzc-textarea" rows={3} value={draft.fail_criteria_en.join('\n')} onChange={e => updateList('fail_criteria_en', e.target.value)} placeholder="EN criteria (lines)" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Recommendation & source */}
          <div className="form-section">
            <div className="section-head">
              <div className="section-icon"><IconSparkles size={16} /></div>
              <div>
                <div className="section-title">Recommendation & source</div>
                <div className="section-desc">위반 시 제안할 권장사항과 규칙 출처</div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>권장사항 템플릿 (KR)</label>
                <textarea className="mzc-textarea" rows={2} value={draft.recommendation_template_kr} onChange={e => update({ recommendation_template_kr: e.target.value })} placeholder="예: {섹션}에 Bedrock 토큰 사용량 가정을 추가하세요" />
              </div>
              <div className="form-field">
                <label>Recommendation (EN)</label>
                <textarea className="mzc-textarea" rows={2} value={draft.recommendation_template_en} onChange={e => update({ recommendation_template_en: e.target.value })} placeholder="e.g. Add Bedrock token usage assumption to {section}" />
              </div>
              <div className="form-field span-2">
                <label>Source</label>
                <input className="mzc-input" value={draft.source} onChange={e => update({ source: e.target.value })}
                  placeholder="e.g. Custom / Team X" />
              </div>
            </div>
          </div>

          {err && (
            <div style={{
              padding: '12px 14px', fontSize: 12.5, color: color.error,
              background: color.errorSoft, border: '1px solid #fecaca',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
            }}>
              <IconAlert size={14} /> {err}
            </div>
          )}
        </div>

        <div className="mzc-modal-footer">
          <div className="footer-hint">
            <IconInfo size={12} />
            <span className="req" style={{ color: color.error }}>*</span> 표시는 필수 입력입니다
          </div>
          <div className="footer-actions">
            <button className="mzc-btn mzc-btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="mzc-btn mzc-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : (isEdit ? <><IconCheck size={14} /> Save changes</> : <><IconPlus size={14} /> Add rule</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function emptyRule(): RuleDefinition {
  return {
    rule_id: '',
    enabled: true,
    custom: true,
    category_en: '',
    category_kr: '',
    title_en: '',
    title_kr: '',
    description_en: '',
    description_kr: '',
    severity: 'Medium',
    evaluation_type: 'llm',
    related_sections: [],
    pass_criteria_en: [],
    pass_criteria_kr: [],
    warning_criteria_en: [],
    warning_criteria_kr: [],
    fail_criteria_en: [],
    fail_criteria_kr: [],
    recommendation_template_en: '',
    recommendation_template_kr: '',
    source: 'Custom',
  }
}
