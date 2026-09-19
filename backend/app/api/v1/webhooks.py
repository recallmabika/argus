import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models import WebhookConfig

router = APIRouter()


class WebhookPayloadIn(BaseModel):
    name: str
    url: str
    platform: Optional[str] = None
    webhook_type: Optional[str] = None
    min_severity: str = "HIGH"
    is_enabled: Optional[bool] = True
    active: Optional[bool] = True


@router.get("/")
async def list_webhooks(db: AsyncSession = Depends(get_db)):
    """Lists all configured SIEM/chat alerting webhooks."""
    res = await db.execute(select(WebhookConfig).order_by(desc(WebhookConfig.created_at)))
    configs = res.scalars().all()
    
    return [
        {
            "id": wh.id,
            "name": wh.name,
            "url": wh.url,
            "platform": wh.webhook_type,
            "webhook_type": wh.webhook_type,
            "min_severity": wh.min_severity,
            "active": wh.is_enabled,
            "is_enabled": wh.is_enabled,
            "created_at": wh.created_at.isoformat() if wh.created_at else ""
        }
        for wh in configs
    ]


@router.post("/")
async def create_webhook(
    payload: WebhookPayloadIn,
    db: AsyncSession = Depends(get_db)
):
    """Registers a new alerting webhook destination."""
    wh_type = (payload.platform or payload.webhook_type or "GENERIC_JSON").upper().strip()
    enabled = payload.is_enabled if payload.is_enabled is not None else (payload.active if payload.active is not None else True)
    
    wh = WebhookConfig(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        url=payload.url.strip(),
        webhook_type=wh_type,
        min_severity=payload.min_severity.upper().strip(),
        is_enabled=enabled,
        created_at=datetime.now(timezone.utc)
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    
    return {
        "id": wh.id,
        "name": wh.name,
        "url": wh.url,
        "platform": wh.webhook_type,
        "webhook_type": wh.webhook_type,
        "min_severity": wh.min_severity,
        "active": wh.is_enabled,
        "is_enabled": wh.is_enabled,
        "created_at": wh.created_at.isoformat() if wh.created_at else ""
    }


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Removes a configured webhook by ID."""
    res = await db.execute(select(WebhookConfig).where(WebhookConfig.id == webhook_id))
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook configuration not found")
        
    await db.delete(wh)
    await db.commit()
    return {"success": True, "message": f"Webhook '{wh.name}' removed successfully."}
