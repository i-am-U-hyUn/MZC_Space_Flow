"""Discovery Agent — project info collection and structuring.

Refactored as a ``strands.Agent()`` logical agent within the Parent Runtime.
Collects project information via LLM-powered analysis, identifies missing
fields, and distinguishes draft-required vs export-required inputs.

Requirements: 6.1, 6.2, 6.3, 6.4
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from strands import Agent
from strands.models.bedrock import BedrockModel

from agent.lib.schema.document_state import DocumentMode, DocumentState, FieldValue, FieldStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------

CHILD_MODEL: str = os.environ.get(
    "CHILD_MODEL",
    "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
)

# Max tokens for bulk extraction from long inputs (emails, design docs, etc.).
# Claude 3.5 Sonnet v2 supports up to 8192 output tokens.
DISCOVERY_MAX_TOKENS: int = int(os.environ.get("DISCOVERY_MAX_TOKENS", "8192"))

# ---------------------------------------------------------------------------
# Field classification constants
# ---------------------------------------------------------------------------

DRAFT_REQUIRED_FIELDS: list[str] = [
    "customer",
    "project_goal",
    "scope_summary",
    "architecture_available",
]

EXPORT_REQUIRED_FIELDS: list[str] = [
    "sponsor",
    "stakeholders",
    "team_detail",
    "phase_schedule",
    "cost_resources",
]

# ---------------------------------------------------------------------------
# System prompt for the Discovery Agent
# ---------------------------------------------------------------------------

DISCOVERY_PROMPT: str = """당신은 APN PoC Project Plan 문서 생성을 위한 프로젝트 정보 수집 전문 에이전트입니다.

## 역할
사용자의 입력(이메일 스레드, 미팅 노트, 자유 기술 등)에서 프로젝트 정보를 최대한 추출하여 구조화합니다.
입력이 길 경우(이메일 스레드 등) 모든 단락을 꼼꼼히 살펴서 누락 없이 채우세요.
제공되지 않은 값은 null / 빈 배열 / 빈 문자열로 두고, 절대 지어내지 마세요.

## 추출 대상 필드
다음 필드를 사용자 입력에서 추출하세요:

### Draft-required (초안 생성 필수):
- customer: 고객사명 (예: "(주)빠르다커머스")
- partner: 파트너사명 (예: "메가존클라우드")
- project_goal: 프로젝트 목표 (한 문장)
- scope_summary: 프로젝트 범위 요약 (한 문장)
- architecture_available: 기존 아키텍처 자료 유무 (true/false/null)
- start_date: 시작 예정일 (YYYY-MM-DD)
- duration_weeks: 기간(주)

### Export-required (DOCX export 필수):
- sponsor, stakeholders, team_detail, phase_schedule, cost_resources (자유 기술)
- executive_summary 5개 필드 (customer_intro, problem_statement, proposed_solution, phases_overview, business_case)
- executive_sponsors, stakeholders list, project_team, escalation_contacts (연락처 구조화)
- success_criteria.groups, assumptions.groups, scope_of_work.tasks
- milestones (W1~W6 phases 구조화)
- acceptance_steps (인수 기준 항목화)
- cost_info (총액, 인력비, AWS 사용료)

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

```json
{
  "extracted_fields": {
    "customer": "추출된 고객사명 또는 null",
    "partner": "추출된 파트너사명 또는 null",
    "project_goal": "추출된 목표 또는 null",
    "scope_summary": "추출된 범위 또는 null",
    "architecture_available": true,
    "start_date": "2026-05-18 또는 null",
    "duration_weeks": 6,
    "sponsor": "추출된 스폰서 또는 null",
    "stakeholders": "추출된 이해관계자 자유 기술 또는 null",
    "team_detail": "추출된 팀 상세 또는 null",
    "phase_schedule": "추출된 일정 또는 null",
    "cost_resources": "추출된 비용 정보 또는 null"
  },
  "executive_summary": {
    "customer_intro": "고객사 소개 한 단락",
    "problem_statement": "문제/현황 한 단락",
    "proposed_solution": "제안 솔루션 한 단락",
    "phases_overview": ["단계1 개요", "단계2 개요"],
    "business_case": {
      "problem_definition": "비즈니스 문제 정의",
      "roi_calculation": "기대 효과",
      "executive_sponsor": "임원 스폰서",
      "production_commitment": "운영 이관 계획"
    }
  },
  "executive_sponsors": [
    {"name": "김정오", "title": "팀장", "description": "빠르다커머스 데이터플랫폼팀 팀장", "contact": "010-2345-6789"}
  ],
  "stakeholders": [
    {"name": "...", "title": "...", "stakeholder_for": "...", "contact": "..."}
  ],
  "project_team": [
    {"name": "이아련", "title": "매니저", "role": "PM", "contact": "010-9876-5432"},
    {"name": "최정현", "title": "", "role": "솔루션 아키텍트", "contact": ""},
    {"name": "김선우", "title": "", "role": "데이터엔지니어", "contact": ""}
  ],
  "escalation_contacts": [
    {"name": "정하린", "title": "CTO", "role": "고객사 에스컬레이션", "contact": ""}
  ],
  "success_criteria": [],
  "success_criteria_groups": [
    {"category_name": "Performance", "bullets": ["E2E 지연 p95 ≤ 5분", "쿼리 응답 p95 ≤ 3초"]},
    {"category_name": "Quality", "bullets": ["이벤트 유실률 ≤ 0.1%"]}
  ],
  "assumptions": [],
  "assumption_groups": [
    {"category_name": "Technical Environment", "bullets": ["Site-to-Site VPN 사용", "PII 가명화 전제"]}
  ],
  "scope_of_work": [],
  "scope_tasks": [
    {"task_category": "Kinesis 수집", "schedule": "W2-W3", "details": "주문/클릭 2개 토픽, 3천 TPS", "personnel": "DE"},
    {"task_category": "S3 데이터레이크", "schedule": "W2-W3", "details": "Glue Catalog 포함", "personnel": "DE"}
  ],
  "milestones": [
    {"phase": "W1 (5/18~5/22): 킥오프 + 환경 셋업", "completion_date": "2026-05-22",
     "deliverables": ["VPC/IAM/S3 구성", "이벤트 스키마 문서 v1"]},
    {"phase": "W2~W3 (5/25~6/5): Kinesis 수집 + S3 적재 + Glue ETL", "completion_date": "2026-06-05",
     "deliverables": ["파이프라인 E2E 통과", "정합성 테스트 리포트"]}
  ],
  "acceptance_steps": [
    {"heading": "E2E 테스트", "content": "실제 샘플 이벤트 100만 건 기반",
     "bullets": ["4개 성공 기준 지표 충족"]},
    {"heading": "교육 및 인계", "content": "",
     "bullets": ["핸즈온 교육 2회 완료", "피드백 만족도 ≥ 4.0/5.0", "Terraform 코드 + 운영 가이드 인계"]}
  ],
  "cost_info": {
    "total_amount": "48,500,000",
    "staffing_total": "44,800,000",
    "aws_usage_total": "3,700,000",
    "currency": "KRW",
    "notes": "VAT 별도"
  },
  "acceptance_text": "단일 문단 인수 기준 또는 빈 문자열",
  "missing_fields": ["ex: executive_sponsors"],
  "follow_up_questions": []
}
```

## 지시
- 이메일 스레드/긴 문서가 입력되면 전체를 읽고 **가능한 모든 필드를 채우세요**. 부분만 채우지 마세요.
- 사람 이름과 직책은 이메일 헤더/서명/본문을 모두 참고하여 구조화하세요.
- 마일스톤은 가능한 실제 표기(예: "W1 (5/18~5/22)")를 `phase`에 넣고, 단계별 산출물은 `deliverables` 배열에 개별 항목으로 넣으세요.
- 인수 기준은 가능한 2~4개 단계로 그룹화하세요.
- 금액은 숫자만이 아닌 원본 표기(콤마 포함)를 문자열로 유지하세요.
- 누락되거나 불확실한 값은 null / 빈 배열 / 빈 문자열로 두세요.
"""

# ---------------------------------------------------------------------------
# Follow-up question templates
# ---------------------------------------------------------------------------

_FOLLOW_UP_TEMPLATES: dict[str, str] = {
    "customer": "고객사명을 알려주세요.",
    "project_goal": "프로젝트의 주요 목표는 무엇인가요?",
    "scope_summary": "프로젝트 범위를 간략히 설명해주세요.",
    "architecture_available": "기존 아키텍처 자료(.drawio 등)가 있나요?",
    "sponsor": "프로젝트 스폰서 정보를 입력해주세요.",
    "stakeholders": "주요 이해관계자 목록을 알려주세요.",
    "team_detail": "팀 구성 상세 정보를 입력해주세요.",
    "phase_schedule": "단계별 일정 정보를 입력해주세요.",
    "cost_resources": "비용 및 리소스 정보를 입력해주세요.",
}

SUCCESS_CRITERIA_GROUP_LABELS = [
    "Strategy Development & Planning",
    "Technical Framework Design",
    "Implementation Roadmap",
    "Knowledge Transfer",
    "Project Objective",
]

ASSUMPTION_GROUP_LABELS = [
    "Business Context",
    "Technical Environment",
    "Project Execution",
    "Scope Boundaries",
    "Future Considerations",
]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class MissingFields:
    """Classification of missing fields into draft-required vs export-required."""
    draft_required: list[str] = field(default_factory=list)
    export_required: list[str] = field(default_factory=list)


@dataclass
class DiscoveryResult:
    """Result of the discovery/collection process."""
    structured_input: dict[str, Any] = field(default_factory=dict)
    missing: MissingFields = field(default_factory=MissingFields)
    follow_up_questions: list[str] = field(default_factory=list)
    can_generate_draft: bool = False
    executive_summary: str = ""
    executive_sponsors: list[dict[str, str]] = field(default_factory=list)
    stakeholders: list[dict[str, str]] = field(default_factory=list)
    project_team: list[dict[str, str]] = field(default_factory=list)
    escalation_contacts: list[dict[str, str]] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    scope_of_work: list[str] = field(default_factory=list)
    acceptance_text: str = ""
    missing_fields: list[str] = field(default_factory=list)
    executive_summary_fields: dict[str, Any] = field(default_factory=dict)
    business_case: dict[str, Any] = field(default_factory=dict)
    success_criteria_groups: list[dict[str, Any]] = field(default_factory=list)
    assumption_groups: list[dict[str, Any]] = field(default_factory=list)
    scope_tasks: list[dict[str, Any]] = field(default_factory=list)
    # v2 bulk-extraction additions
    partner: str = ""
    start_date: str = ""
    duration_weeks: int = 0
    milestones: list[dict[str, Any]] = field(default_factory=list)
    acceptance_steps: list[dict[str, Any]] = field(default_factory=list)
    cost_info: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Discovery Agent
# ---------------------------------------------------------------------------

class DiscoveryAgent:
    """Collects and structures project information from user input.

    Uses a ``strands.Agent()`` instance with CHILD_MODEL for LLM-powered
    input analysis. Falls back to keyword-based extraction if the LLM
    call fails.
    """

    def __init__(self) -> None:
        from agent.lib.progress import make_runtime_callback_handler, RuntimeProgressHooks
        # Use BedrockModel explicitly so we can raise max_tokens for bulk extraction
        # from long email threads / design docs. Claude 3.5 Sonnet v2 supports up to
        # 8192 output tokens.
        self.agent = Agent(
            model=BedrockModel(
                model_id=CHILD_MODEL,
                max_tokens=DISCOVERY_MAX_TOKENS,
            ),
            system_prompt=DISCOVERY_PROMPT,
            callback_handler=make_runtime_callback_handler("discovery_agent"),
            hooks=[RuntimeProgressHooks("discovery_agent")],
        )

    async def collect_info(
        self, user_input: str, doc_state: DocumentState
    ) -> DiscoveryResult:
        """Analyze input, identify missing items, structure or ask follow-ups.

        1. Send user input to the LLM agent for structured extraction
        2. Merge extracted fields with existing doc_state
        3. Classify missing fields (draft-required vs export-required)
        4. Generate follow-up questions for missing draft-required fields
        5. Determine if draft generation can proceed

        Requirements: 6.1, 6.2, 6.3, 6.4
        """
        # Step 1: Extract structured fields from user input
        extracted = await self._extract_fields(user_input)

        # Step 2: Merge with existing document state
        structured = self._merge_with_state(extracted, doc_state)

        # Step 3: Classify missing fields
        missing = self.classify_missing_fields(doc_state, structured)

        # Step 4: Generate follow-up questions ONLY for draft-required missing fields.
        # export-required fields are NOT asked here — they are validated at export time
        # so the user is not overwhelmed with 7+ questions after providing a single piece
        # of info. Draft generation needs only draft-required fields (Req 6.4).
        questions: list[str] = []
        for f in missing.draft_required:
            questions.append(_FOLLOW_UP_TEMPLATES.get(f, f"{f} 정보를 입력해주세요."))

        # draft-required만 누락 여부로 초안 생성 가능 판단 (Req 6.4)
        can_draft = len(missing.draft_required) == 0

        return DiscoveryResult(
            structured_input=structured,
            missing=missing,
            follow_up_questions=questions,
            can_generate_draft=can_draft,
            executive_summary=_executive_summary_text(structured.get("executive_summary")),
            executive_sponsors=_contact_list(structured.get("executive_sponsors")),
            stakeholders=_contact_list(structured.get("stakeholders")),
            project_team=_contact_list(structured.get("project_team")),
            escalation_contacts=_contact_list(structured.get("escalation_contacts")),
            success_criteria=_string_list(structured.get("success_criteria")),
            assumptions=_string_list(structured.get("assumptions")),
            scope_of_work=_string_list(structured.get("scope_of_work")),
            acceptance_text=_string_value(structured.get("acceptance_text")),
            missing_fields=_string_list(structured.get("missing_fields")),
            executive_summary_fields=_executive_summary_fields(structured.get("executive_summary")),
            business_case=_business_case(structured.get("executive_summary"), structured.get("business_case")),
            success_criteria_groups=_category_groups(
                structured.get("success_criteria_groups") or structured.get("success_criteria"),
                SUCCESS_CRITERIA_GROUP_LABELS,
            ),
            assumption_groups=_category_groups(
                structured.get("assumption_groups") or structured.get("assumptions"),
                ASSUMPTION_GROUP_LABELS,
            ),
            scope_tasks=_scope_tasks(structured.get("scope_tasks") or structured.get("scope_of_work")),
            partner=_string_value(structured.get("partner")),
            start_date=_string_value(structured.get("start_date")),
            duration_weeks=_int_value(structured.get("duration_weeks")),
            milestones=_milestones(structured.get("milestones")),
            acceptance_steps=_acceptance_steps(structured.get("acceptance_steps")),
            cost_info=_cost_info(structured.get("cost_info")),
        )

    def classify_missing_fields(
        self,
        doc_state: DocumentState,
        collected: dict[str, Any] | None = None,
    ) -> MissingFields:
        """Classify missing fields into draft-required vs export-required.

        draft-required (초안 생성 필수):
            고객사명, 프로젝트 목표, 대략적 범위, 아키텍처 유무

        export-required (DOCX export 필수):
            Sponsor, Stakeholder, Team 상세, phase별 일정, 비용/리소스 정보

        When only export-required fields are missing, draft generation
        is NOT blocked (Req 6.4).

        Each field is considered present if either:
          1. The current turn's `collected` dict has it, OR
          2. `doc_state` already has the corresponding value persisted from a prior turn.
        """
        collected = collected or {}
        meta = doc_state.meta
        sections = doc_state.sections
        exec_summary = sections.executive_summary
        scope = sections.scope_of_work
        stakeholders_section = sections.stakeholders
        milestones_section = sections.milestones
        rce = sections.resources_cost_estimates

        # --- Draft-required fields ---
        draft_missing: list[str] = []

        # customer: collected dict OR doc_state.meta.customer
        if not collected.get("customer") and not _has_value(meta.customer):
            draft_missing.append("customer")

        # project_goal: collected dict OR executive_summary.customer_intro
        if not collected.get("project_goal") and not _has_value(exec_summary.customer_intro):
            draft_missing.append("project_goal")

        # scope_summary: collected dict OR executive_summary.problem_statement
        #                OR non-empty scope_of_work (tasks/items)
        if (
            not collected.get("scope_summary")
            and not _has_value(exec_summary.problem_statement)
            and not scope.tasks
            and not scope.items
        ):
            draft_missing.append("scope_summary")

        # architecture_available: collected dict OR doc_state.mode explicitly set
        #                         OR existing architecture.services
        if (
            collected.get("architecture_available") is None
            and not sections.architecture.services
            and doc_state.mode != DocumentMode.architecture_present
            # architecture_absent is the default; treat only explicit _present as confirmation
        ):
            draft_missing.append("architecture_available")

        # --- Export-required fields (also check doc_state to avoid re-asking) ---
        export_missing: list[str] = []
        if not collected.get("sponsor") and not stakeholders_section.executive_sponsors:
            export_missing.append("sponsor")
        if not collected.get("stakeholders") and not stakeholders_section.stakeholders:
            export_missing.append("stakeholders")
        if not collected.get("team_detail") and not stakeholders_section.project_team:
            export_missing.append("team_detail")
        if not collected.get("phase_schedule") and not milestones_section.phases:
            export_missing.append("phase_schedule")
        if (
            not collected.get("cost_resources")
            and not rce.phase_hours_table
            and not rce.role_rates
        ):
            export_missing.append("cost_resources")

        return MissingFields(
            draft_required=draft_missing,
            export_required=export_missing,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _extract_fields(self, user_input: str) -> dict[str, Any]:
        """Use the LLM agent to extract structured fields from user input.

        Falls back to keyword-based extraction if the LLM call fails.
        """
        try:
            response = self.agent(user_input)
            return self._parse_agent_response(str(response))
        except Exception as exc:
            logger.warning(
                "LLM extraction failed, falling back to keyword extraction: %s",
                exc,
            )
            return self._keyword_extract(user_input)

    def _parse_agent_response(self, response_text: str) -> dict[str, Any]:
        """Parse the JSON response from the LLM agent."""
        # Try to find JSON block in the response
        text = response_text.strip()

        # Strip markdown code fences if present
        if "```json" in text:
            start = text.index("```json") + len("```json")
            end = text.index("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.index("```") + len("```")
            end = text.index("```", start)
            text = text[start:end].strip()

        try:
            parsed = json.loads(text)
            extracted = dict(parsed.get("extracted_fields", {}))
            for key, value in parsed.items():
                if key not in ("extracted_fields", "follow_up_questions"):
                    extracted[key] = value
            return _normalize_extracted(extracted)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Failed to parse LLM response as JSON, using keyword fallback")
            return {}

    @staticmethod
    def _keyword_extract(user_input: str) -> dict[str, Any]:
        """Fallback keyword-based extraction when LLM is unavailable."""
        structured: dict[str, Any] = {}
        input_lower = user_input.lower()

        if any(kw in input_lower for kw in ["고객", "customer", "회사"]):
            structured["customer"] = _extract_customer_value(user_input)
        if any(kw in input_lower for kw in ["목표", "goal", "목적"]):
            structured["project_goal"] = user_input
        if any(kw in input_lower for kw in ["범위", "scope"]):
            structured["scope_summary"] = user_input
        if any(kw in input_lower for kw in ["아키텍처", "architecture", "drawio"]):
            structured["architecture_available"] = True

        return structured

    @staticmethod
    def _merge_with_state(
        extracted: dict[str, Any], doc_state: DocumentState
    ) -> dict[str, Any]:
        """Merge newly extracted fields with existing document state values."""
        merged = dict(extracted)

        # Carry forward existing meta.customer if not newly extracted
        if "customer" not in merged and _has_value(doc_state.meta.customer):
            merged["customer"] = (
                doc_state.meta.customer.user_input
                or doc_state.meta.customer.ai_recommended
            )

        return merged


def _has_value(field_value: FieldValue) -> bool:
    """Check if a FieldValue has any meaningful value set."""
    return bool(field_value.user_input or field_value.ai_recommended)


def _extract_customer_value(user_input: str) -> str:
    """Extract the customer name from simple Korean/English edit phrases."""
    text = user_input.strip()
    patterns = [
        r"([A-Za-z0-9가-힣_.&-]+)\s*고객사",
        r"고객사(?:명)?(?:는|은|를|을|로|으로|:|=)?\s*([A-Za-z0-9가-힣_.& -]+?)(?:\s*(?:으로|로)?\s*(?:수정|변경|설정|해줘|해주세요)|\s*입니다|\s*이다|$)",
        r"customer(?:\s+name)?\s*(?:is|to|=|:)?\s*([A-Za-z0-9가-힣_.& -]+?)(?:\s*(?:please|$))",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = match.group(1).strip(" .,:;은는이가을를")
            if value:
                return value
    return text


def _string_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [_string_value(v) for v in value if _string_value(v)]
    if isinstance(value, str):
        return [value] if value else []
    return [_string_value(value)]


def _executive_summary_text(value: Any) -> str:
    if isinstance(value, dict):
        return _string_value(
            value.get("summary")
            or value.get("text")
            or value.get("proposed_solution")
            or value.get("problem_statement")
        )
    return _string_value(value)


def _executive_summary_fields(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {
        "customer_intro": _string_value(value.get("customer_intro")),
        "problem_statement": _string_value(value.get("problem_statement")),
        "proposed_solution": _string_value(value.get("proposed_solution")),
        "phases_overview": _string_list(value.get("phases_overview")),
    }


def _business_case(summary_value: Any, explicit_value: Any = None) -> dict[str, Any]:
    source = explicit_value
    if source is None and isinstance(summary_value, dict):
        source = summary_value.get("business_case")
    if not isinstance(source, dict):
        return {}
    return {
        "problem_definition": _string_value(source.get("problem_definition")),
        "roi_calculation": _string_value(source.get("roi_calculation")),
        "executive_sponsor": _string_value(source.get("executive_sponsor")),
        "production_commitment": _string_value(source.get("production_commitment")),
    }


def _category_groups(value: Any, default_labels: list[str]) -> list[dict[str, Any]]:
    """v2: uses bullets (not items) for CategoryGroup."""
    if value is None:
        return []
    if isinstance(value, list) and all(isinstance(item, dict) for item in value):
        groups = []
        for index, item in enumerate(value):
            groups.append({
                "category_name": _string_value(item.get("category_name") or item.get("name") or default_labels[min(index, len(default_labels) - 1)]),
                "bullets": _string_list(item.get("bullets") or item.get("items")),
            })
        return groups
    items = _string_list(value)
    if not items:
        return []
    return [{"category_name": default_labels[0], "bullets": items}]


def _scope_tasks(value: Any) -> list[dict[str, Any]]:
    """v2: details is a single string (not list[str])."""
    if value is None:
        return []
    if isinstance(value, list) and all(isinstance(item, dict) for item in value):
        return [
            {
                "task_category": _string_value(item.get("task_category") or item.get("category")),
                "schedule": _string_value(item.get("schedule")),
                "details": _details_to_string(item.get("details")),
                "personnel": _string_value(item.get("personnel")),
            }
            for item in value
        ]
    items = _string_list(value)
    if not items:
        return []
    return [{"task_category": "Scope Boundaries", "schedule": "", "details": "\n".join(items), "personnel": ""}]


def _details_to_string(value: Any) -> str:
    """Convert details to a single string (v2: ScopeTask.details is FieldValue, not list)."""
    if value is None:
        return ""
    if isinstance(value, list):
        return "\n".join(str(v) for v in value if v)
    return _string_value(value)


def _contact_list(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    contacts: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        contacts.append({
            "name": _string_value(item.get("name")),
            "title": _string_value(item.get("title")),
            "description": _string_value(item.get("description")),
            "stakeholder_for": _string_value(item.get("stakeholder_for")),
            "role": _string_value(item.get("role")),
            "contact": _string_value(item.get("contact")),
        })
    return contacts


def _int_value(value: Any) -> int:
    """Coerce a potentially-string numeric value to int (0 on failure)."""
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    try:
        return int(float(str(value).replace(",", "").strip()))
    except (ValueError, TypeError):
        return 0


def _milestones(value: Any) -> list[dict[str, Any]]:
    """Normalize milestones to a list of {phase, completion_date, deliverables[]}."""
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        deliverables = item.get("deliverables")
        if isinstance(deliverables, str):
            deliverables = [d.strip() for d in deliverables.split("\n") if d.strip()]
        elif not isinstance(deliverables, list):
            deliverables = []
        result.append({
            "phase": _string_value(item.get("phase") or item.get("name")),
            "completion_date": _string_value(
                item.get("completion_date") or item.get("date") or item.get("end_date")
            ),
            "deliverables": [_string_value(d) for d in deliverables if _string_value(d)],
        })
    return result


def _acceptance_steps(value: Any) -> list[dict[str, Any]]:
    """Normalize acceptance steps to a list of {heading, content, bullets[]}."""
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        bullets = item.get("bullets")
        if isinstance(bullets, str):
            bullets = [b.strip() for b in bullets.split("\n") if b.strip()]
        elif not isinstance(bullets, list):
            bullets = []
        result.append({
            "heading": _string_value(item.get("heading") or item.get("title")),
            "content": _string_value(item.get("content") or item.get("description")),
            "bullets": [_string_value(b) for b in bullets if _string_value(b)],
        })
    return result


def _cost_info(value: Any) -> dict[str, Any]:
    """Normalize cost_info to a dict with totals and notes."""
    if not isinstance(value, dict):
        return {}
    return {
        "total_amount": _string_value(value.get("total_amount") or value.get("total")),
        "staffing_total": _string_value(value.get("staffing_total") or value.get("staffing")),
        "aws_usage_total": _string_value(value.get("aws_usage_total") or value.get("aws_total")),
        "currency": _string_value(value.get("currency")) or "KRW",
        "notes": _string_value(value.get("notes")),
    }


def _normalize_extracted(extracted: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    list_fields = {
        "executive_sponsors",
        "stakeholders",
        "project_team",
        "escalation_contacts",
        "success_criteria",
        "assumptions",
        "scope_of_work",
        "success_criteria_groups",
        "assumption_groups",
        "scope_tasks",
        "missing_fields",
        "milestones",
        "acceptance_steps",
    }
    string_fields = {"executive_summary", "acceptance_text", "partner", "start_date"}
    dict_fields = {"cost_info"}

    for key, value in extracted.items():
        if value is None:
            if key in list_fields:
                normalized[key] = []
            elif key in string_fields:
                normalized[key] = ""
            elif key in dict_fields:
                normalized[key] = {}
            continue
        normalized[key] = value

    return normalized
