"""AgentCore Runtime entry point — Parent Orchestrator.

Deploys the Parent Orchestrator on AgentCore Runtime using
``BedrockAgentCoreApp`` + ``@app.entrypoint``.

The ``/invocations`` POST endpoint receives ``doc_id``, ``prompt``,
and bounded ``history`` (recent N turns).  Document state mutations
are delivered exclusively via the AppSync ``docs/{docId}/patch``
channel; the HTTP response carries only the chat reply and metadata.

Environment variables
---------------------
PARENT_MODEL : str
    Inference profile for the Parent Orchestrator.
    Default: ``global.anthropic.claude-opus-4-6-v1``
CHILD_MODEL : str
    Inference profile for sub-agents (Sonnet 3.5 v2).
    Default: ``apac.anthropic.claude-3-5-sonnet-20241022-v2:0``
PARENT_MODEL_FALLBACK : str
    Fallback inference profile for the Parent Orchestrator when primary is unavailable.
    Default: ``""`` (empty — degraded mode if primary fails)
CHILD_MODEL_FALLBACK : str
    Fallback inference profile for sub-agents when primary is unavailable.
    Default: ``""`` (empty — degraded mode if primary fails)
DOCUMENTS_TABLE / DYNAMODB_TABLE : str
    DynamoDB table used for authoritative Document_State persistence.
    Default: ``doc-agent-documents``
AGENTCORE_GATEWAY_ID : str
    Optional AgentCore Gateway identifier for MCP tool invocation.
"""

from __future__ import annotations

import logging
import os
import json
from typing import Any

from bedrock_agentcore import BedrockAgentCoreApp

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configurable model inference profiles (overridable via env vars)
# ---------------------------------------------------------------------------

PARENT_MODEL: str = os.environ.get(
    "PARENT_MODEL",
    "global.anthropic.claude-opus-4-6-v1",
)

CHILD_MODEL: str = os.environ.get(
    "CHILD_MODEL",
    "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
)

PARENT_MODEL_FALLBACK: str = os.environ.get(
    "PARENT_MODEL_FALLBACK",
    "",
)

CHILD_MODEL_FALLBACK: str = os.environ.get(
    "CHILD_MODEL_FALLBACK",
    "",
)

REVIEWER_MODEL: str = os.environ.get("REVIEWER_MODEL", CHILD_MODEL)
REVIEWER_MODEL_FALLBACK: str = os.environ.get(
    "REVIEWER_MODEL_FALLBACK",
    "apac.amazon.nova-lite-v1:0",
)

# ---------------------------------------------------------------------------
# AgentCore Runtime application
# ---------------------------------------------------------------------------

app = BedrockAgentCoreApp()


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise


def _invoke_reviewer_model(client: Any, model_id: str, system: str, user_payload: dict[str, Any]) -> dict[str, Any]:
    resp = client.converse(
        modelId=model_id,
        system=[{"text": system}],
        messages=[{
            "role": "user",
            "content": [{"text": json.dumps(user_payload, ensure_ascii=False)}],
        }],
        inferenceConfig={"maxTokens": 8000, "temperature": 0},
    )
    text = ""
    message = resp.get("output", {}).get("message", {})
    for block in message.get("content", []):
        if isinstance(block, dict) and block.get("text"):
            text += block["text"]
    return _extract_json_object(text)


def _unchecked_reviewer_evaluation(rule: dict[str, Any], reason: str) -> dict[str, Any]:
    rule_id = str(rule.get("rule_id", ""))
    return {
        "rule_id": rule_id,
        "status": "NOT_CHECKED",
        "severity": rule.get("severity", "Medium"),
        "llm_judgment_en": f"AgentCore Reviewer could not complete this rule judgment: {reason}",
        "llm_judgment_kr": f"AgentCore Reviewer가 이 규칙 판단을 완료하지 못했습니다: {reason}",
        "evidence_found": [],
        "missing_evidence_en": ["Reviewer judgment unavailable."],
        "missing_evidence_kr": ["Reviewer 판단 결과를 사용할 수 없습니다."],
        "recommendation_en": rule.get("recommendation_template_en", "Review this rule manually before submission."),
        "recommendation_kr": rule.get("recommendation_template_kr", "제출 전 이 규칙을 수동으로 검토하십시오."),
        "referenced_sections": rule.get("related_sections", []),
        "suggested_patch_available": False,
        "suggested_patch": None,
    }


def _reviewer_payload(
    review_job_id: str,
    document_snapshot: dict[str, Any],
    rules: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "review_job_id": review_job_id,
        "document_snapshot": document_snapshot,
        "rules": rules,
        "output_schema": {
            "review_job_id": "string",
            "rule_evaluations": [{
                "rule_id": "string",
                "status": "PASS|WARNING|FAIL|NOT_CHECKED",
                "severity": "Critical|High|Medium|Low|Info",
                "llm_judgment_en": "concise summary",
                "llm_judgment_kr": "간결한 요약",
                "evidence_found": [{"section": "string", "text": "short snippet", "field_path": "string"}],
                "missing_evidence_en": ["string"],
                "missing_evidence_kr": ["string"],
                "recommendation_en": "string",
                "recommendation_kr": "string",
                "referenced_sections": ["string"],
                "suggested_patch_available": False,
                "suggested_patch": None,
            }],
        },
    }


def _invoke_reviewer_rules(
    client: Any,
    model_id: str,
    system: str,
    review_job_id: str,
    document_snapshot: dict[str, Any],
    rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not rules:
        return []
    try:
        parsed = _invoke_reviewer_model(
            client,
            model_id,
            system,
            _reviewer_payload(review_job_id, document_snapshot, rules),
        )
        evaluations = parsed.get("rule_evaluations", [])
        if not isinstance(evaluations, list):
            raise ValueError("rule_evaluations must be a list")
        return [item for item in evaluations if isinstance(item, dict)]
    except Exception as exc:
        err = getattr(exc, "response", {}).get("Error", {}) if hasattr(exc, "response") else {}
        if err.get("Code") == "AccessDeniedException":
            raise
        if len(rules) == 1:
            return [_unchecked_reviewer_evaluation(rules[0], str(exc)[:180])]
        mid = max(1, len(rules) // 2)
        return (
            _invoke_reviewer_rules(client, model_id, system, review_job_id, document_snapshot, rules[:mid])
            + _invoke_reviewer_rules(client, model_id, system, review_job_id, document_snapshot, rules[mid:])
        )


def _reviewer_table_name() -> str:
    return os.environ.get("DOCUMENTS_TABLE", "doc-agent-documents")


def _now_iso_utc() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _persist_reviewer_success(
    review_job_pk: str,
    table_name: str,
    agent_result: dict[str, Any],
) -> None:
    """Write the reviewer agent_result to the review_job DynamoDB item.

    The document_api Lambda computes the merged_result lazily at read time
    using its own rule_evaluations helpers, so this Runtime path only stores
    ``agent_result`` along with completion metadata.
    """
    import boto3
    if not review_job_pk or not table_name:
        logger.warning(
            "persist_reviewer_success skipped (missing pk=%s or table=%s)",
            review_job_pk, table_name,
        )
        return
    table = boto3.resource("dynamodb", region_name=_runtime_region()).Table(table_name)
    now = _now_iso_utc()
    try:
        table.update_item(
            Key={"document_id": review_job_pk},
            UpdateExpression=(
                "SET #status = :completed, "
                "agent_review_status = :completed, "
                "agent_result = :agent_result, "
                "updated_at = :now, "
                "completed_at = :now, "
                "error_reason = :empty, "
                "merged_result = :null_merged "
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":completed": "completed",
                ":agent_result": agent_result,
                ":now": now,
                ":empty": "",
                ":null_merged": None,
            },
        )
        logger.info("persist_reviewer_success pk=%s", review_job_pk)
    except Exception as exc:
        logger.exception("persist_reviewer_success failed pk=%s: %s", review_job_pk, exc)
        raise


def _persist_reviewer_failure(
    review_job_pk: str,
    table_name: str,
    error_reason: str,
) -> None:
    import boto3
    if not review_job_pk or not table_name:
        return
    table = boto3.resource("dynamodb", region_name=_runtime_region()).Table(table_name)
    now = _now_iso_utc()
    try:
        table.update_item(
            Key={"document_id": review_job_pk},
            UpdateExpression=(
                "SET #status = :failed, "
                "agent_review_status = :failed, "
                "updated_at = :now, "
                "completed_at = :now, "
                "error_reason = :reason "
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":failed": "failed",
                ":now": now,
                ":reason": (error_reason or "")[:500],
            },
        )
        logger.info("persist_reviewer_failure pk=%s reason=%s", review_job_pk, error_reason[:120])
    except Exception as exc:
        logger.exception("persist_reviewer_failure failed pk=%s: %s", review_job_pk, exc)


def _invoke_reviewer_agent(payload: dict[str, Any]) -> dict[str, Any]:
    """AgentCore Reviewer Agent entrypoint for rule matrix judgment.

    Runs inside AgentCore Runtime. Asks Bedrock for concise JSON judgments
    over llm/hybrid rules, then writes the final ``agent_result`` straight
    to the ``review_job#<id>`` DynamoDB item so the document_api Lambda can
    return quickly without holding the HTTP connection open during the
    full Bedrock loop (fire-and-forget from the Lambda side).
    """
    import boto3

    review_job_id = str(payload.get("review_job_id", ""))
    review_job_pk = str(payload.get("review_job_pk") or "")
    review_job_table = str(payload.get("review_job_table") or _reviewer_table_name())
    document_snapshot = payload.get("document_snapshot") or {}
    rules = payload.get("enabled_rules") or []
    baseline = payload.get("baseline_result") or {}
    logger.info(
        "reviewer_agent invoked review_job_id=%s rule_count=%d pk=%s table=%s",
        review_job_id,
        len(rules) if isinstance(rules, list) else 0,
        review_job_pk,
        review_job_table,
    )
    baseline_by_rule = {
        str(item.get("rule_id")): item
        for item in baseline.get("rule_evaluations", [])
        if isinstance(item, dict) and item.get("rule_id")
    }
    compact_rules = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        compact_rules.append({
            "rule_id": rule.get("rule_id"),
            "evaluation_type": rule.get("evaluation_type"),
            "category_en": rule.get("category_en"),
            "category_kr": rule.get("category_kr"),
            "title_en": rule.get("title_en"),
            "title_kr": rule.get("title_kr"),
            "severity": rule.get("severity"),
            "related_sections": rule.get("related_sections", []),
            "pass_criteria_en": rule.get("pass_criteria_en", []),
            "warning_criteria_en": rule.get("warning_criteria_en", []),
            "fail_criteria_en": rule.get("fail_criteria_en", []),
            "recommendation_template_en": rule.get("recommendation_template_en", ""),
            "recommendation_template_kr": rule.get("recommendation_template_kr", ""),
            "baseline_status": baseline_by_rule.get(str(rule.get("rule_id")), {}).get("status"),
            "baseline_evidence": baseline_by_rule.get(str(rule.get("rule_id")), {}).get("evidence_found", []),
            "baseline_missing": baseline_by_rule.get(str(rule.get("rule_id")), {}).get("missing_evidence_en", []),
        })

    system = (
        "You are the AgentCore Reviewer Agent for APN/GenAI IC/SOW readiness. "
        "Return JSON only. Do not reveal chain-of-thought. Use concise judgment summaries. "
        "Only use evidence from the supplied document snapshot. Do not say 'AWS will reject this'; "
        "use 'recommended before submission' wording. If evidence is absent, use NOT_CHECKED or FAIL. "
        "Statuses must be PASS, WARNING, FAIL, or NOT_CHECKED."
    )
    client = boto3.client("bedrock-runtime", region_name=_runtime_region())
    model_used = REVIEWER_MODEL
    try:
        try:
            evaluations = _invoke_reviewer_rules(
                client, REVIEWER_MODEL, system, review_job_id, document_snapshot, compact_rules
            )
        except Exception as primary_exc:
            if not REVIEWER_MODEL_FALLBACK or REVIEWER_MODEL_FALLBACK == REVIEWER_MODEL:
                raise
            logger.warning(
                "reviewer model '%s' failed, falling back to '%s': %s",
                REVIEWER_MODEL,
                REVIEWER_MODEL_FALLBACK,
                primary_exc,
            )
            model_used = REVIEWER_MODEL_FALLBACK
            evaluations = _invoke_reviewer_rules(
                client, REVIEWER_MODEL_FALLBACK, system, review_job_id, document_snapshot, compact_rules
            )
    except Exception as exc:
        logger.exception("reviewer_agent failed review_job_id=%s", review_job_id)
        _persist_reviewer_failure(review_job_pk, review_job_table, str(exc)[:500])
        return {"status": "error", "review_job_id": review_job_id, "error": str(exc)[:500]}

    agent_result = {
        "review_job_id": review_job_id,
        "model_used": model_used,
        "rule_evaluations": evaluations,
    }
    # Persist directly to DynamoDB so the fire-and-forget Lambda can finish
    # immediately. The document_api Lambda merges baseline + agent_result
    # lazily at read time.
    _persist_reviewer_success(review_job_pk, review_job_table, agent_result)
    logger.info(
        "reviewer_agent completed review_job_id=%s evaluations=%d model=%s",
        review_job_id, len(evaluations), model_used,
    )
    return {"status": "ok", "agent_result": agent_result}


def _validate_payload(payload: dict[str, Any]) -> tuple[str, str, list[dict]]:
    """Extract and validate required fields from the invocation payload.

    Returns
    -------
    tuple[str, str, list[dict]]
        ``(doc_id, prompt, history)``

    Raises
    ------
    ValueError
        If ``doc_id`` or ``prompt`` is missing / empty.
    """
    doc_id = payload.get("doc_id")
    if not doc_id or (isinstance(doc_id, str) and not doc_id.strip()):
        raise ValueError("payload must include a non-empty 'doc_id'")

    prompt = payload.get("prompt")
    if not prompt or (isinstance(prompt, str) and not prompt.strip()):
        raise ValueError("payload must include a non-empty 'prompt'")

    history: list[dict] = payload.get("history", [])
    return doc_id, prompt, history


@app.entrypoint
def invoke(payload: dict) -> dict:
    """AgentCore Runtime entry point.

    Called via ``POST /invocations`` through API Gateway.

    Parameters
    ----------
    payload : dict
        Expected keys:
        - ``doc_id``  (str, required) — target document identifier
        - ``prompt``  (str, required) — user chat message
        - ``history`` (list[dict], optional) — bounded recent N turns

    Returns
    -------
    dict
        ``{"result": <chat_response>, "version": <new_version>, "status": "ok"}``

    Processing steps (delegated to :class:`ParentOrchestrator`):
        1. Retrieve long-term context from AgentCore Memory
        2. Fetch ``Document_State`` + version from DynamoDB
        3. Build task plan → delegate to sub-agents
        4. Generate patches → apply with optimistic lock to DynamoDB
        5. Publish patches / status / chat via AppSync Events
        6. Store session events in AgentCore Memory
    """
    try:
        if not isinstance(payload, dict):
            return {"result": "payload must be a JSON object (dict)", "version": 0, "status": "error"}
        if payload.get("action") == "review_rule_matrix":
            return _invoke_reviewer_agent(payload)
        doc_id, prompt, history = _validate_payload(payload)
    except ValueError as exc:
        return {"result": str(exc), "version": 0, "status": "error"}

    logger.info(
        "invoke called — doc_id=%s, prompt_len=%d, history_turns=%d",
        doc_id,
        len(prompt),
        len(history),
    )

    # ------------------------------------------------------------------
    # Delegate to ParentOrchestrator.handle_message()
    # ------------------------------------------------------------------
    import asyncio
    from agent.app.parent.orchestrator import ParentOrchestrator

    try:
        orchestrator = _get_orchestrator()
    except Exception as exc:
        logger.exception("orchestrator initialization failed")
        return {
            "result": f"runtime initialization failed: {exc}",
            "version": 0,
            "status": "error",
        }

    try:
        plan = asyncio.run(
            orchestrator.handle_message(
                doc_id,
                prompt,
                history,
                user_id=str(payload.get("user_id", "") or ""),
            )
        )
    except RuntimeError:
        # Already inside a running event loop (e.g. AgentCore Runtime)
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            plan = pool.submit(
                asyncio.run,
                orchestrator.handle_message(
                    doc_id,
                    prompt,
                    history,
                    user_id=str(payload.get("user_id", "") or ""),
                ),
            ).result()
    except Exception as exc:
        logger.exception("orchestrator invocation failed")
        return {
            "result": f"runtime invocation failed: {exc}",
            "version": 0,
            "status": "error",
        }

    return {
        "result": plan.chat_response,
        "version": plan.new_version,
        "status": "ok" if plan.status in ("completed", "partial_completed") else "error",
        "orchestration_status": plan.status,
        "changed_sections": plan.changed_sections,
        "created_change_request_ids": plan.created_change_request_ids,
        "tool_results": plan.tool_results,
        "degraded_messages": plan.degraded_messages,
        "execution_log": plan.execution_log,
    }


# ---------------------------------------------------------------------------
# Orchestrator singleton
# ---------------------------------------------------------------------------

_orchestrator_instance: "ParentOrchestrator | None" = None


def _runtime_region() -> str:
    return os.environ.get("AWS_REGION", "ap-northeast-2")


def _documents_table_name() -> str:
    return (
        os.environ.get("DOCUMENTS_TABLE")
        or os.environ.get("DYNAMODB_TABLE")
        or "doc-agent-documents"
    )


def _build_document_store(region: str) -> Any:
    from agent.lib.storage.dynamodb import DynamoDBDocumentStore

    return DynamoDBDocumentStore(
        table_name=_documents_table_name(),
        region_name=region,
    )


def _build_memory(region: str) -> Any | None:
    from agent.lib.memory.agentcore_memory import AgentCoreMemory

    memory_id = os.environ.get("AGENTCORE_MEMORY_ID", "")
    if not memory_id:
        logger.info("AGENTCORE_MEMORY_ID not set — running without Memory")
        return None

    logger.info("AgentCoreMemory initialized with memory_id=%s", memory_id)
    return AgentCoreMemory(
        memory_id=memory_id,
        region=region,
    )


def _build_gateway_client(region: str) -> Any | None:
    from agent.lib.gateway.agentcore_gateway import AgentCoreGatewayClient

    gateway_id = os.environ.get("AGENTCORE_GATEWAY_ID", "")
    if not gateway_id:
        logger.info("AGENTCORE_GATEWAY_ID not set — running without Gateway")
        return None

    logger.info("AgentCoreGatewayClient initialized with gateway_id=%s", gateway_id)
    return AgentCoreGatewayClient(
        gateway_id=gateway_id,
        region=region,
    )


def _get_orchestrator() -> "ParentOrchestrator":
    """Return a module-level ParentOrchestrator singleton.

    Lazily initialized on first call. The document store and memory
    instances are shared across invocations within the same Runtime.

    When ``AGENTCORE_MEMORY_ID`` is set, an :class:`AgentCoreMemory`
    instance is created and wired into the orchestrator for long-term
    context retrieval and session event storage (Req 2.1, 2.2, 2.3).
    """
    global _orchestrator_instance
    if _orchestrator_instance is None:
        from agent.app.parent.orchestrator import ParentOrchestrator
        region = _runtime_region()

        _orchestrator_instance = ParentOrchestrator(
            document_store=_build_document_store(region),
            memory=_build_memory(region),
            gateway_client=_build_gateway_client(region),
        )
    return _orchestrator_instance


if os.environ.get("DOC_AGENT_DISABLE_APP_RUN") != "1":
    app.run(host="0.0.0.0")
