import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useDocumentStore,
  type ArchitectureSection as ArchitectureModel,
  type ArchitectureService,
  type FieldValue,
  type ServiceCategory,
} from '../../store/documentStore'
import { useSessionStore } from '../../store/sessionStore'
import { FieldValueEditor } from '../editors/FieldValueEditor'
import { EditableComboField } from '../editors/EditableComboField'
import { ListEditor } from '../editors/ListEditor'
import { SaveStatusIndicator } from '../SaveStatusIndicator'
import { SectionGuideButton } from '../SectionGuideButton'
import { useSaveStatus } from '../../hooks/useSaveStatus'
import { saveUserInput } from '../../utils/api'
import { useDocLang } from '../LangContext'
import { apiFetch } from '../../auth/api'
import { color, font, size, space } from '../../styles/tokens'
import { isBedrockService } from '../../utils/frontendSchema'
import { resolveFieldValue } from '../AiBadge'
import {
  SERVICE_NAME_PRESETS,
  SERVICE_DESCRIPTION_PRESETS,
} from '../../constants/documentPresets'

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'genai_core', 'data', 'compute', 'network', 'security', 'monitoring',
]

const emptyField = (): FieldValue => ({
  user_input: null,
  ai_recommended: null,
  calculated: null,
  status: 'empty',
  user_edited: false,
})

function createEmptyService(): ArchitectureService {
  return {
    service_name: emptyField(),
    description: emptyField(),
    sizing_rationale: emptyField(),
    priority: 99,
    category: 'compute',
    is_required_for_funding: false,
  }
}

/** Resolve description presets for a given service name. */
function getDescriptionPresetsForService(serviceName: FieldValue | undefined | null): readonly (string | number)[] {
  const name = resolveFieldValue(serviceName)
  if (typeof name === 'string' && name in SERVICE_DESCRIPTION_PRESETS) {
    return [SERVICE_DESCRIPTION_PRESETS[name as keyof typeof SERVICE_DESCRIPTION_PRESETS]]
  }
  return []
}

export function ArchitectureSection() {
  const lang = useDocLang()
  const koData = useDocumentStore(s => s.sections?.architecture) as ArchitectureModel | undefined
  const enData = useDocumentStore(s => s.sections_en?.architecture) as ArchitectureModel | undefined
  const archSection = lang === 'en' ? enData : koData
  const setDocument = useDocumentStore(s => s.setDocument)
  const docId = useSessionStore(s => s.currentDocId) || ''
  const { saveStatus: arraySaveStatus, doSave: doArraySave } = useSaveStatus()

  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({})
  // XML held in memory for the viewer. We keep it separate from the S3 URL so
  // the iframe can render without a pre-signed-URL round trip.
  const [drawioXml, setDrawioXml] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const previewUrl = archSection?.preview_url ?? null
  const drawioUrl = archSection?.drawio_url ?? null
  const services: ArchitectureService[] = useMemo(
    () => archSection?.services ?? [],
    [archSection?.services],
  )
  const toolsList: FieldValue[] = useMemo(() => archSection?.tools_list ?? [], [archSection?.tools_list])

  // --- viewer.diagrams.net iframe protocol ---
  // https://www.drawio.com/doc/faq/embed-mode
  // We speak JSON over postMessage. The viewer sends {event: "init"} once it
  // is ready; we reply with {action: "load", xml: <string>}. For PNG export
  // we send {action: "export", format: "png"} and receive {event: "export",
  // data: "data:image/png;base64,..."}.
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return
      const src = (ev.source as Window | null) ?? null
      if (!iframeRef.current || src !== iframeRef.current.contentWindow) return
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (!msg || typeof msg !== 'object') return

      if (msg.event === 'init') {
        setViewerReady(true)
        if (drawioXml) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'load', xml: drawioXml }),
            '*',
          )
        }
        return
      }
      if (msg.event === 'export' && typeof msg.data === 'string') {
        void uploadPreview(msg.data)
        return
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
    // uploadPreview is defined below via useCallback and already captures docId;
    // drawioXml change triggers a re-register so the latest value is used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawioXml])

  // If the viewer was already ready and xml changes (e.g. new file dropped),
  // push the new xml immediately.
  useEffect(() => {
    if (viewerReady && drawioXml && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ action: 'load', xml: drawioXml }),
        '*',
      )
    }
  }, [viewerReady, drawioXml])

  // --- Drawio upload (JSON payload to backend) ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.drawio') && !file.name.endsWith('.xml')) {
      setError('.drawio 또는 .xml 파일만 업로드 가능합니다.')
      return
    }

    setFileName(file.name)
    setError(null)
    setUploading(true)
    setExportMessage(null)

    try {
      const text = await file.text()
      setDrawioXml(text) // render locally immediately

      const res = await apiFetch(`/documents/${docId}/architecture/upload`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, content: text }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Upload failed: ${res.status} ${body}`)
      }
    } catch (err) {
      console.error('[architecture upload]', err)
      setError('업로드 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setUploading(false)
    }
  }

  // --- PNG export via viewer postMessage → upload to backend ---
  const uploadPreview = useCallback(async (dataUrl: string) => {
    if (!docId) return
    setExporting(true)
    setExportMessage(null)
    try {
      const res = await apiFetch(`/documents/${docId}/architecture/preview`, {
        method: 'POST',
        body: JSON.stringify({ png_base64: dataUrl }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Preview upload failed: ${res.status} ${body}`)
      }
      setExportMessage('프리뷰 이미지가 저장되었습니다.')
    } catch (err) {
      console.error('[architecture preview upload]', err)
      setExportMessage('프리뷰 저장에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }, [docId])

  const requestPngExport = useCallback(() => {
    if (!viewerReady || !iframeRef.current?.contentWindow) {
      setExportMessage('다이어그램 뷰어가 아직 준비되지 않았습니다.')
      return
    }
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ action: 'export', format: 'png', xml: drawioXml ?? undefined }),
      '*',
    )
  }, [viewerReady, drawioXml])

  // --- Overview field update ---
  const updateOverview = useCallback((newField: FieldValue) => {
    const sections = useDocumentStore.getState().sections || {}
    const current = (sections.architecture || {}) as ArchitectureModel
    setDocument({ sections: { ...sections, architecture: { ...current, overview: newField } } } as any)
  }, [setDocument])

  // --- Service FieldValue field updates (service_name, description, sizing_rationale) ---
  const updateServiceFieldValue = useCallback(
    (index: number, field: 'service_name' | 'description' | 'sizing_rationale') =>
      (newField: FieldValue) => {
        const sections = useDocumentStore.getState().sections || {}
        const current = (sections.architecture || {}) as ArchitectureModel
        const currentServices = [...(current.services ?? [])]
        const oldService = currentServices[index] || createEmptyService()
        currentServices[index] = { ...oldService, [field]: newField }
        setDocument({ sections: { ...sections, architecture: { ...current, services: currentServices } } } as any)
      },
    [setDocument],
  )

  // --- Service primitive field updates (priority, category, is_required_for_funding) ---
  const updateServicePrimitive = useCallback(
    (index: number, field: 'priority' | 'category' | 'is_required_for_funding', value: number | string | boolean) => {
      const sections = useDocumentStore.getState().sections || {}
      const current = (sections.architecture || {}) as ArchitectureModel
      const currentServices = [...(current.services ?? [])]
      const oldService = currentServices[index] || createEmptyService()
      currentServices[index] = { ...oldService, [field]: value }
      setDocument({ sections: { ...sections, architecture: { ...current, services: currentServices } } } as any)
      // Persist full services array for primitive changes
      const updatedServices = [...currentServices]
      doArraySave(() => saveUserInput(docId, 'sections.architecture.services', updatedServices))
    },
    [setDocument, docId, doArraySave],
  )

  // --- Add/remove services ---
  const addService = useCallback(() => {
    const sections = useDocumentStore.getState().sections || {}
    const current = (sections.architecture || {}) as ArchitectureModel
    const updated = [...(current.services ?? []), createEmptyService()]
    setDocument({ sections: { ...sections, architecture: { ...current, services: updated } } } as any)
    doArraySave(() => saveUserInput(docId, 'sections.architecture.services', updated))
  }, [setDocument, docId, doArraySave])

  const removeService = useCallback((index: number) => {
    const sections = useDocumentStore.getState().sections || {}
    const current = (sections.architecture || {}) as ArchitectureModel
    const updated = (current.services ?? []).filter((_, i) => i !== index)
    setDocument({ sections: { ...sections, architecture: { ...current, services: updated } } } as any)
    doArraySave(() => saveUserInput(docId, 'sections.architecture.services', updated))
  }, [setDocument, docId, doArraySave])

  // --- Tools list update ---
  const handleToolsChange = useCallback((newItems: FieldValue[]) => {
    const sections = useDocumentStore.getState().sections || {}
    const current = (sections.architecture || {}) as ArchitectureModel
    setDocument({ sections: { ...sections, architecture: { ...current, tools_list: newItems } } } as any)
  }, [setDocument])

  return (
    <div>
      <h2 style={headingStyle}>
        4. Architecture
        <SectionGuideButton sectionKey="architecture" />
      </h2>

      {/* Drawio upload */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'inline-block', padding: '8px 16px', background: color.bgPrimary,
            borderRadius: 6, cursor: uploading ? 'wait' : 'pointer', border: `1px dashed ${color.border}`,
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <input
            type="file"
            accept=".drawio,.xml"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          {uploading ? '업로드 중...' : '.drawio 파일 업로드'}
        </label>
        {fileName && <span style={{ marginLeft: 12, color: color.textSecondary }}>{fileName}</span>}
        {error && <div style={{ color: color.error, fontSize: 13, marginTop: 4 }}>{error}</div>}
      </div>

      {/* Overview */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={subHeading}>Overview</h3>
        <FieldValueEditor
          field={archSection?.overview}
          dotPath="sections.architecture.overview.user_input"
          docId={docId}
          placeholder="아키텍처 개요를 입력하세요"
          multiline
          onLocalUpdate={updateOverview}
        />
      </div>

      {/* Services */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={subHeading}>Services</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={addService} style={addButton}>+ Add Service</button>
          <SaveStatusIndicator status={arraySaveStatus} />
        </div>

        {services.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {services.map((service, index) => (
              <div key={service.service_id ?? index} style={serviceCard}>
                {/* Header row: service name + badges + delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={label}>Service Name</div>
                    <EditableComboField
                      field={service.service_name}
                      dotPath={`sections.architecture.services.${index}.service_name.user_input`}
                      docId={docId}
                      placeholder="서비스 이름"
                      presets={SERVICE_NAME_PRESETS}
                      onLocalUpdate={updateServiceFieldValue(index, 'service_name')}
                    />
                    {service.service_id && (
                      <div style={{ fontSize: 11, color: color.textMuted, marginTop: 2 }}>
                        {service.service_id}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => removeService(index)} style={deleteButton}>삭제</button>
                </div>

                {/* Description */}
                <div style={{ marginTop: 10 }}>
                  <div style={label}>Description</div>
                  <EditableComboField
                    field={service.description}
                    dotPath={`sections.architecture.services.${index}.description.user_input`}
                    docId={docId}
                    placeholder="서비스 설명"
                    multiline
                    presets={getDescriptionPresetsForService(service.service_name)}
                    onLocalUpdate={updateServiceFieldValue(index, 'description')}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAdvancedOpen(prev => ({ ...prev, [index]: !prev[index] }))}
                  style={advancedToggle}
                >
                  {advancedOpen[index] ? 'Hide advanced' : 'Show advanced'}
                </button>

                {advancedOpen[index] && (
                  <div style={advancedPanel}>
                    <div>
                      <div style={label}>Sizing Rationale</div>
                      <FieldValueEditor
                        field={service.sizing_rationale}
                        dotPath={`sections.architecture.services.${index}.sizing_rationale.user_input`}
                        docId={docId}
                        placeholder="사이징 근거"
                        multiline
                        onLocalUpdate={updateServiceFieldValue(index, 'sizing_rationale')}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                      <div>
                        <div style={label}>Priority</div>
                        <input
                          type="number"
                          value={service.priority ?? 99}
                          onChange={(e) => updateServicePrimitive(index, 'priority', Number(e.target.value) || 0)}
                          style={primitiveInput}
                          min={0}
                        />
                      </div>
                      <div>
                        <div style={label}>Category</div>
                        <select
                          value={service.category ?? 'compute'}
                          onChange={(e) => updateServicePrimitive(index, 'category', e.target.value as ServiceCategory)}
                          style={primitiveSelect}
                        >
                          {SERVICE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
                        <input
                          type="checkbox"
                          checked={service.is_required_for_funding ?? false}
                          onChange={(e) => updateServicePrimitive(index, 'is_required_for_funding', e.target.checked)}
                          id={`funding-${index}`}
                        />
                        <label htmlFor={`funding-${index}`} style={{ fontSize: 12, color: color.textSecondary, cursor: 'pointer' }}>
                          Funding Required
                        </label>
                        {isBedrockService(service) && <span style={bedrockChip}>Bedrock</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, textAlign: 'center', color: color.textMuted }}>
            {uploading
              ? '다이어그램 분석 중...'
              : fileName
                ? '다이어그램 처리 대기 중... (AppSync 패치로 업데이트됩니다)'
                : '서비스가 아직 추가되지 않았습니다.'}
          </div>
        )}
      </div>

      {/* Tools List */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={subHeading}>Tools</h3>
        <ListEditor
          items={toolsList}
          listDotPath="sections.architecture.tools_list"
          docId={docId}
          onItemsChange={handleToolsChange}
          placeholder="도구 이름 입력"
        />
      </div>

      {/* Diagram preview (viewer.diagrams.net iframe + PNG export) */}
      {(drawioXml || drawioUrl || previewUrl) && (
        <div>
          <h3 style={subHeading}>Diagram Preview</h3>

          {drawioXml ? (
            <div style={viewerWrapper}>
              <iframe
                ref={iframeRef}
                title="architecture-diagram-viewer"
                src="https://viewer.diagrams.net/?embed=1&proto=json&spinner=1&noSaveBtn=1&noExitBtn=1&lightbox=0&highlight=0000ff"
                style={viewerIframe}
              />
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Architecture diagram preview"
              style={{ maxWidth: '100%', border: `1px solid ${color.border}`, borderRadius: 8 }}
            />
          ) : null}

          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {drawioXml && (
              <button
                type="button"
                onClick={requestPngExport}
                disabled={!viewerReady || exporting}
                style={exportButton}
              >
                {exporting ? 'PNG 저장 중...' : 'PNG로 저장'}
              </button>
            )}
            {drawioUrl && (
              <a href={drawioUrl} style={{ color: color.info, fontSize: 13 }} download>
                원본 .drawio 다운로드
              </a>
            )}
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: color.info, fontSize: 13 }}>
                저장된 PNG 보기
              </a>
            )}
            {exportMessage && (
              <span style={{ color: color.textSecondary, fontSize: 12 }}>{exportMessage}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Styles ---

const headingStyle: React.CSSProperties = {
  marginBottom: 16,
  fontSize: size.lg,
  fontWeight: 600,
  fontFamily: font.heading,
  display: 'flex',
  alignItems: 'center',
  gap: space.xs,
}

const subHeading: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: color.textSecondary, marginBottom: 8, marginTop: 0,
}

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: color.textMuted, marginBottom: 2,
}

const serviceCard: React.CSSProperties = {
  padding: 12,
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  background: color.bgSurface,
}

const advancedToggle: React.CSSProperties = {
  marginTop: 10,
  background: 'none',
  border: `1px solid ${color.border}`,
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  color: color.textSecondary,
  fontSize: 12,
}

const advancedPanel: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  border: `1px dashed ${color.border}`,
  borderRadius: 6,
  background: color.bgPrimary,
}

const addButton: React.CSSProperties = {
  background: 'none', border: `1px dashed ${color.border}`,
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
  color: color.textSecondary, fontSize: 12,
}

const deleteButton: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '6px 10px',
  background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: 12,
}

const primitiveInput: React.CSSProperties = {
  width: 60, padding: '4px 6px', border: `1px solid ${color.border}`,
  borderRadius: 4, fontSize: 13, background: color.bgSurface,
}

const primitiveSelect: React.CSSProperties = {
  padding: '4px 6px', border: `1px solid ${color.border}`,
  borderRadius: 4, fontSize: 13, background: color.bgSurface, cursor: 'pointer',
}

const bedrockChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 8px', borderRadius: 999,
  background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
  fontSize: 11,
}

const viewerWrapper: React.CSSProperties = {
  position: 'relative',
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  overflow: 'hidden',
  background: '#fff',
}

const viewerIframe: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 520,
  border: 'none',
}

const exportButton: React.CSSProperties = {
  padding: '6px 12px',
  border: `1px solid ${color.border}`,
  borderRadius: 6,
  background: color.bgPrimary,
  color: color.textPrimary,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}
