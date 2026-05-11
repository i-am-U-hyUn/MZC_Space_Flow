"""Gateway Lambda: estimate_cost

Invokes the Node.js Calculator Link Lambda (ported from
aws-calculator-mcp) to get per-service cost estimates and a shareable
calculator.aws URL. Falls back to a local fallback_card when the
Node Lambda is unavailable or returns an error.

Input (via event["inputPayload"] JSON):
    {
        "doc_id": "doc-001",
        "services": [
            {
                "service_name": "AWS Lambda",
                "service_code": "aWSLambda",        # calculator.aws serviceCode
                "config": { "noOfRequests": {"value": 10, "unit": "millionPerMonth"} },
                "monthly_cost_hint": 100,           # optional fallback
                "templateId": "lambdaWithFreeTier"  # optional
            }
        ],
        "region": "ap-northeast-2",
        "name": "Doc Agent Estimate"                # optional
    }

Output:
    {
        "monthly_cost_summary": 1113.68,
        "service_breakdown": [
            {
                "service_name": "AWS Lambda",
                "service_code": "aWSLambda",
                "monthly_cost": 244.13,
                "upfront_cost": 0,
                "supported_by_calculator": true,
                "note": null
            }
        ],
        "calculator_share_url": "https://calculator.aws/#/estimate?id=...",
        "manual_estimate_items": [...],
        "fallback_card": null | {...},
        "warnings": [...]
    }
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import boto3

logger = logging.getLogger(__name__)

REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
# Name of the Node.js Lambda that wraps calculator.aws (ported from aws-calculator-mcp).
# Set by Terraform after deployment.
CALCULATOR_LINK_LAMBDA_NAME = os.environ.get("CALCULATOR_LINK_LAMBDA_NAME", "")


def _build_fallback_card(services: list[dict]) -> dict[str, Any]:
    items = []
    for svc in services:
        est = svc.get("monthly_cost_hint") or svc.get("monthly_cost")
        try:
            est = float(est) if est is not None else None
        except (TypeError, ValueError):
            est = None
        items.append({
            "service_name": svc.get("service_name", "Unknown"),
            "service_code": svc.get("service_code", ""),
            "monthly_cost": est,
            "note": "Estimate unavailable — manual review required" if est is None else None,
        })
    return {
        "type": "fallback",
        "message": "Calculator link backend unavailable",
        "items": items,
    }


def _invoke_node_lambda(services: list[dict], region: str, name: str) -> dict[str, Any]:
    """Invoke the Node.js Calculator Link Lambda synchronously."""
    client = boto3.client("lambda", region_name=REGION)
    payload = {
        "services": services,
        "region": region,
        "name": name,
    }
    resp = client.invoke(
        FunctionName=CALCULATOR_LINK_LAMBDA_NAME,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    if resp.get("FunctionError"):
        raw = resp["Payload"].read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Node Calculator Lambda error ({resp['FunctionError']}): {raw[:400]}")
    body = resp["Payload"].read()
    if isinstance(body, (bytes, bytearray)):
        body = body.decode("utf-8")
    parsed = json.loads(body or "{}")
    if isinstance(parsed, dict) and "statusCode" in parsed and "body" in parsed:
        try:
            parsed = json.loads(parsed.get("body") or "{}")
        except Exception:
            parsed = {}
    if not isinstance(parsed, dict):
        raise RuntimeError("Node Calculator Lambda returned non-object payload")
    return parsed


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    try:
        raw = event.get("inputPayload", "{}")
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        params = json.loads(raw) if isinstance(raw, str) else (raw or {})

        services = params.get("services", []) or []
        region = str(params.get("region") or REGION)
        name = str(params.get("name") or "Doc Agent Estimate")

        breakdown: list[dict] = []
        manual_items: list[dict] = []
        total = 0.0
        share_url: str | None = None
        fallback_card: dict | None = None
        warnings: list[str] = []

        if not services:
            return {"outputPayload": json.dumps({
                "monthly_cost_summary": 0.0,
                "service_breakdown": [],
                "calculator_share_url": None,
                "manual_estimate_items": [],
                "fallback_card": None,
                "warnings": ["No services provided"],
            })}

        if not CALCULATOR_LINK_LAMBDA_NAME:
            warnings.append(
                "CALCULATOR_LINK_LAMBDA_NAME not configured — returning fallback only"
            )
            fallback_card = _build_fallback_card(services)
            manual_items = [
                {
                    "service_name": s.get("service_name", "Unknown"),
                    "service_code": s.get("service_code", ""),
                    "monthly_cost": s.get("monthly_cost_hint"),
                    "supported_by_calculator": False,
                }
                for s in services
            ]
        else:
            try:
                mcp_result = _invoke_node_lambda(services, region, name)
                breakdown = mcp_result.get("service_breakdown") or []
                share_url = mcp_result.get("calculator_share_url")
                total = float(mcp_result.get("monthly_total") or 0.0)
                manual_items = mcp_result.get("manual_estimate_items") or []
                extra_warnings = mcp_result.get("warnings") or []
                if isinstance(extra_warnings, list):
                    warnings.extend(str(w) for w in extra_warnings if w)
                if not breakdown and not share_url:
                    fallback_card = _build_fallback_card(services)
            except Exception as mcp_err:
                logger.warning("Calculator Node Lambda failed: %s", mcp_err)
                warnings.append(f"Calculator Node Lambda failed: {type(mcp_err).__name__}: {mcp_err}")
                manual_items = [
                    {
                        "service_name": s.get("service_name", "Unknown"),
                        "service_code": s.get("service_code", ""),
                        "monthly_cost": s.get("monthly_cost_hint"),
                        "supported_by_calculator": False,
                    }
                    for s in services
                ]
                fallback_card = _build_fallback_card(services)

        result = {
            "monthly_cost_summary": round(total, 2),
            "service_breakdown": breakdown,
            "calculator_share_url": share_url,
            "manual_estimate_items": manual_items,
            "fallback_card": fallback_card,
            "warnings": warnings,
        }
        return {"outputPayload": json.dumps(result)}

    except Exception as e:
        logger.exception("estimate_cost handler error")
        return {"outputPayload": json.dumps({
            "error": str(e),
            "monthly_cost_summary": 0.0,
            "service_breakdown": [],
            "calculator_share_url": None,
            "manual_estimate_items": [],
            "fallback_card": {
                "type": "fallback",
                "message": f"handler_error: {type(e).__name__}",
                "items": [],
            },
            "warnings": [f"handler_error: {type(e).__name__}: {e}"],
        })}
