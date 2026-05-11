"""
Cognito Post-Confirmation Lambda Trigger.

가입 확인이 완료된 직후 호출된다. 해당 이메일로 대기 중인 공유
초대(pending_shares)가 있으면 실제 공유 테이블(document_shares)로
승격시키고 pending에서 제거한다.

이벤트 예시:
{
  "request": {
    "userAttributes": {
      "email": "user@mz.co.kr",
      "sub": "abcd-1234-..."
    }
  }
}
"""

from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
PENDING_TABLE = os.environ.get("PENDING_SHARES_TABLE", "doc-agent-pending-shares")
SHARES_TABLE = os.environ.get("DOCUMENT_SHARES_TABLE", "doc-agent-document-shares")
DOCUMENTS_TABLE = os.environ.get("DOCUMENTS_TABLE", "doc-agent-documents")

_ddb = boto3.resource("dynamodb", region_name=REGION)
pending_table = _ddb.Table(PENDING_TABLE)
shares_table = _ddb.Table(SHARES_TABLE)
documents_table = _ddb.Table(DOCUMENTS_TABLE)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _promote_pending_for_email(email: str, user_id: str) -> int:
    """Return number of shares promoted."""
    promoted = 0
    resp = pending_table.query(
        KeyConditionExpression=Key("email").eq(email),
    )
    for pending in resp.get("Items", []):
        doc_id = pending.get("document_id")
        if not doc_id:
            continue

        # 최신 문서 메타 확보 (있으면)
        doc_title = pending.get("doc_title", "제목 없음")
        doc_updated_at = pending.get("doc_updated_at", _now_iso())
        try:
            doc_resp = documents_table.get_item(Key={"document_id": doc_id})
            doc_item = doc_resp.get("Item")
            if doc_item:
                doc_title = doc_item.get("title") or doc_title
                doc_updated_at = doc_item.get("updated_at") or doc_updated_at
        except Exception as exc:  # noqa: BLE001
            print(f"[post-confirm] doc lookup failed doc={doc_id}: {exc}")

        share_item = {
            "user_id": user_id,
            "document_id": doc_id,
            "role": pending.get("role", "read"),
            "shared_by": pending.get("shared_by", ""),
            "shared_by_email": pending.get("shared_by_email", ""),
            "shared_at": pending.get("shared_at", _now_iso()),
            "promoted_at": _now_iso(),
            "doc_title": doc_title,
            "doc_updated_at": doc_updated_at,
        }
        try:
            shares_table.put_item(Item=share_item)
            pending_table.delete_item(
                Key={"email": email, "document_id": doc_id}
            )
            promoted += 1
            print(f"[post-confirm] promoted email={email} doc={doc_id}")
        except Exception as exc:  # noqa: BLE001
            print(f"[post-confirm] promote failed doc={doc_id}: {exc}")

    return promoted


def handler(event, context):
    # Cognito Post-Confirmation은 실패해도 가입 자체를 막지 않아야 함.
    # 예외는 모두 삼키고 event를 그대로 반환.
    try:
        user_attrs = event.get("request", {}).get("userAttributes", {}) or {}
        email = (user_attrs.get("email") or "").strip().lower()
        user_id = user_attrs.get("sub") or event.get("userName") or ""
        if not email or not user_id:
            print(f"[post-confirm] missing email/sub: email={email!r} sub={user_id!r}")
            return event

        promoted = _promote_pending_for_email(email, user_id)
        print(f"[post-confirm] email={email} user_id={user_id} promoted={promoted}")
    except Exception as exc:  # noqa: BLE001
        print(f"[post-confirm] unexpected error: {exc}")
        print(traceback.format_exc())

    return event
