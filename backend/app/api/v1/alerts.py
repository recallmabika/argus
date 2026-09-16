from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.core.database import get_db
from app.models import Alert, Device
from app.schemas import AlertOut
from pydantic import BaseModel

router = APIRouter()


class AlertStatusUpdate(BaseModel):
    status: str  # OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE


@router.get("", response_model=List[AlertOut])
async def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Lists security threat alerts."""
    stmt = select(Alert).order_by(desc(Alert.detected_at)).limit(limit)
    if status:
        stmt = stmt.where(Alert.status == status)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertOut)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Fetches details for a specific alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}")
async def update_alert_status(
    alert_id: str,
    update_data: AlertStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Updates the status of an alert (e.g. mark RESOLVED or INVESTIGATING)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = update_data.status.upper()
    await db.commit()
    await db.refresh(alert)
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}


@router.get("/stats/summary")
async def get_alerts_summary(db: AsyncSession = Depends(get_db)):
    """Summary statistics of active threats and MITRE tactics."""
    total = await db.scalar(select(func.count(Alert.id))) or 0
    critical = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "CRITICAL")) or 0
    high = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "HIGH")) or 0
    medium = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "MEDIUM")) or 0
    open_count = await db.scalar(select(func.count(Alert.id)).where(Alert.status == "OPEN")) or 0

    return {
        "total_alerts": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "open": open_count
    }
