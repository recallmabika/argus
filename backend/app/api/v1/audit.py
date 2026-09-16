from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut

router = APIRouter()


@router.get("", response_model=List[AuditLogOut])
async def list_audit_logs(
    limit: int = 50,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns immutable audit logs tracking who accessed which monitoring telemetry,
    camera snapshots, or generated incident reports.
    """
    stmt = select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit)
    if actor:
        stmt = stmt.where(AuditLog.actor_username == actor)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    
    result = await db.execute(stmt)
    return result.scalars().all()
