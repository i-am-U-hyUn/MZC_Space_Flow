import { create } from 'zustand'
import { apiFetch } from '../auth/api'

export interface DocumentSummary {
  document_id: string
  title: any
  updated_at?: string
  created_at?: string
  completion_score?: number
  shared?: boolean
  role?: 'read' | 'edit' | 'master' | 'suggest'
  shared_by_email?: string
}

interface SessionStore {
  documents: DocumentSummary[]
  currentDocId: string | null
  loading: boolean

  fetchDocuments: () => Promise<void>
  createDocument: (title?: string) => Promise<string>
  deleteDocument: (docId: string) => Promise<void>
  selectDocument: (docId: string) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  documents: [],
  currentDocId: null,
  loading: false,

  fetchDocuments: async () => {
    set({ loading: true })
    try {
      const res = await apiFetch('/documents')
      const data = await res.json()
      const docs: DocumentSummary[] = data.documents || []
      set({ documents: docs, loading: false })
      // Auto-select first if none selected
      if (!get().currentDocId && docs.length > 0) {
        set({ currentDocId: docs[0].document_id })
      }
    } catch {
      set({ loading: false })
    }
  },

  createDocument: async (title?: string) => {
    const res = await apiFetch('/documents', {
      method: 'POST',
      body: JSON.stringify({ title: title || '새 문서' }),
    })
    const data = await res.json()
    const docId = data.document_id as string
    // Refresh list and select new doc
    await get().fetchDocuments()
    set({ currentDocId: docId })
    return docId
  },

  deleteDocument: async (docId: string) => {
    await apiFetch(`/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' })
    const { currentDocId } = get()
    await get().fetchDocuments()
    if (currentDocId === docId) {
      const docs = get().documents
      set({ currentDocId: docs.length > 0 ? docs[0].document_id : null })
    }
  },

  selectDocument: (docId: string) => {
    set({ currentDocId: docId })
  },
}))

// 현재 선택된 문서의 공유 여부/권한 헬퍼
export function useCurrentDocAccess(): { shared: boolean; role: string; canEdit: boolean } {
  const documents = useSessionStore(s => s.documents)
  const currentDocId = useSessionStore(s => s.currentDocId)
  const doc = documents.find(d => d.document_id === currentDocId)
  if (!doc) return { shared: false, role: 'master', canEdit: true }
  const role = doc.role || 'master'
  const canEdit = role === 'master' || role === 'edit'
  return { shared: !!doc.shared, role, canEdit }
}
