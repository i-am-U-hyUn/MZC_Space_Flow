import { useEffect, useState } from 'react'
import { apiFetch } from '../auth/api'
import { color, space, radius, shadow } from '../styles/tokens'

interface ShareEntry {
  user_id?: string
  email: string
  role: 'read' | 'edit'
  shared_at?: string
  status: 'active' | 'pending'
}

export interface ShareModalProps {
  open: boolean
  docId: string | null
  docTitle?: string
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  read: '뷰어',
  edit: '편집자',
}

export function ShareModal({ open, docId, docTitle, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'read' | 'edit'>('edit')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null)

  const refresh = async () => {
    if (!docId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/documents/${docId}/shares`)
      if (!res.ok) {
        if (res.status === 403) {
          setMessage({ kind: 'error', text: '공유 목록은 문서 소유자만 볼 수 있습니다.' })
        }
        setShares([])
        return
      }
      const data = await res.json()
      const active: ShareEntry[] = (data.shares || []).map((s: any) => ({
        user_id: s.user_id,
        email: s.email || '',
        role: (s.role || 'read') as 'read' | 'edit',
        shared_at: s.shared_at,
        status: 'active' as const,
      }))
      const pending: ShareEntry[] = (data.pending || []).map((p: any) => ({
        email: p.email,
        role: (p.role || 'read') as 'read' | 'edit',
        shared_at: p.shared_at,
        status: 'pending' as const,
      }))
      setShares([...active, ...pending])
    } catch (e) {
      setMessage({ kind: 'error', text: '공유 목록을 불러오지 못했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && docId) {
      setMessage(null)
      setEmail('')
      setRole('edit')
      refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docId])

  if (!open || !docId) return null

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    const allowedDomains = ['mz.co.kr', 'megazone.com']
    const domain = trimmed.split('@')[1] || ''
    if (!allowedDomains.includes(domain)) {
      setMessage({ kind: 'error', text: '@mz.co.kr, @megazone.com 이메일만 공유 가능합니다.' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/documents/${docId}/shares`, {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.message || data?.error || '공유에 실패했습니다.' })
        return
      }
      if (data.target_status === 'pending') {
        setMessage({ kind: 'info', text: '상대방이 아직 가입하지 않았습니다. 가입 완료 시 자동으로 공유됩니다.' })
      } else {
        setMessage({ kind: 'success', text: `${trimmed} 에게 공유했습니다.` })
      }
      setEmail('')
      refresh()
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || '공유에 실패했습니다.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleChange = async (entry: ShareEntry, newRole: 'read' | 'edit') => {
    const key = entry.status === 'pending' ? encodeURIComponent(entry.email) : entry.user_id
    if (!key) return
    try {
      const res = await apiFetch(`/documents/${docId}/shares/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessage({ kind: 'error', text: data?.message || data?.error || '권한 변경 실패' })
        return
      }
      refresh()
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || '권한 변경 실패' })
    }
  }

  const handleRemove = async (entry: ShareEntry) => {
    const key = entry.status === 'pending' ? encodeURIComponent(entry.email) : entry.user_id
    if (!key) return
    if (!confirm(`${entry.email} 의 접근 권한을 해제하시겠습니까?`)) return
    try {
      const res = await apiFetch(`/documents/${docId}/shares/${key}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessage({ kind: 'error', text: data?.message || data?.error || '해제 실패' })
        return
      }
      refresh()
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || '해제 실패' })
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.48)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxWidth: 'calc(100vw - 32px)',
          background: color.bgSurface, borderRadius: radius.lg,
          boxShadow: shadow.lg, padding: space.lg,
          display: 'flex', flexDirection: 'column', gap: space.md,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary }}>문서 공유</div>
            {docTitle && (
              <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {docTitle}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: color.textMuted,
          }}>✕</button>
        </div>

        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@mz.co.kr"
            required
            style={{
              flex: 1, padding: '8px 10px', border: `1px solid ${color.border}`,
              borderRadius: radius.md, fontSize: 13,
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'read' | 'edit')}
            style={{
              padding: '8px 10px', border: `1px solid ${color.border}`,
              borderRadius: radius.md, fontSize: 13, background: 'white',
            }}
          >
            <option value="edit">편집자</option>
            <option value="read">뷰어</option>
          </select>
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="mzc-btn mzc-btn-primary"
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {submitting ? '초대 중...' : '초대'}
          </button>
        </form>

        <div style={{ fontSize: 11, color: color.textMuted, marginTop: -4 }}>
          @mz.co.kr, @megazone.com 이메일만 공유 가능합니다.
        </div>

        {message && (
          <div style={{
            fontSize: 12, padding: '8px 10px', borderRadius: radius.md,
            background: message.kind === 'error' ? color.errorSoft
                      : message.kind === 'success' ? color.successSoft
                      : color.infoSoft,
            color: message.kind === 'error' ? color.error
                 : message.kind === 'success' ? color.success
                 : color.info,
          }}>
            {message.text}
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
            공유 대상 ({shares.length})
          </div>
          <div style={{
            maxHeight: 260, overflow: 'auto',
            border: `1px solid ${color.border}`, borderRadius: radius.md,
          }}>
            {loading && (
              <div style={{ padding: 16, textAlign: 'center', color: color.textMuted, fontSize: 12 }}>
                불러오는 중...
              </div>
            )}
            {!loading && shares.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: color.textMuted, fontSize: 12 }}>
                아직 공유된 사용자가 없습니다.
              </div>
            )}
            {!loading && shares.map((entry) => (
              <div
                key={`${entry.status}:${entry.email || entry.user_id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderBottom: `1px solid ${color.border}`,
                  background: entry.status === 'pending' ? color.bgSubtle : 'white',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: color.textPrimary, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.email || entry.user_id}
                  </div>
                  <div style={{ fontSize: 11, color: color.textMuted, marginTop: 2 }}>
                    {entry.status === 'pending' ? '가입 대기 중' : '활성'}
                  </div>
                </div>
                <select
                  value={entry.role}
                  onChange={(e) => handleRoleChange(entry, e.target.value as 'read' | 'edit')}
                  style={{
                    padding: '4px 6px', border: `1px solid ${color.border}`,
                    borderRadius: radius.sm, fontSize: 12, background: 'white',
                  }}
                >
                  <option value="edit">{ROLE_LABEL.edit}</option>
                  <option value="read">{ROLE_LABEL.read}</option>
                </select>
                <button
                  onClick={() => handleRemove(entry)}
                  title="공유 해제"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: color.textMuted, fontSize: 14, padding: '2px 4px',
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="mzc-btn"
            style={{
              background: color.bgSubtle, border: `1px solid ${color.border}`,
              borderRadius: radius.md, padding: '6px 14px', fontSize: 13,
              color: color.textPrimary, cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
