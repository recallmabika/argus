import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models import Alert, Device, IncidentReport, AuditLog
from app.schemas import ReportGenerateIn, ReportVerifyIn
from app.services.pdf_generator import pdf_generator
from app.services.signer import signer

router = APIRouter()


@router.post("/generate")
async def generate_report(
    req: ReportGenerateIn,
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a cryptographically signed incident assessment PDF report.
    Calculates SHA-256 digest and Ed25519 digital signature.
    """
    # Fetch alerts
    if req.alert_ids:
        alert_stmt = select(Alert).where(Alert.id.in_(req.alert_ids))
    else:
        alert_stmt = select(Alert).order_by(desc(Alert.detected_at)).limit(20)
    
    alert_res = await db.execute(alert_stmt)
    alerts = alert_res.scalars().all()

    # Fetch active devices
    dev_res = await db.execute(select(Device).limit(10))
    devices = dev_res.scalars().all()

    report_model = pdf_generator.generate_incident_report(
        title=req.title,
        report_type=req.report_type.upper(),
        alerts=alerts,
        devices=devices,
        generated_by="SecOps Lead Analyst"
    )

    db.add(report_model)
    
    # Audit log entry
    audit_entry = AuditLog(
        actor_username="analyst",
        action="GENERATE_INCIDENT_REPORT",
        target_resource="IncidentReport",
        target_id=report_model.id,
        details={"type": req.report_type, "sha256": report_model.sha256_hash}
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(report_model)

    return {
        "status": "ok",
        "report_id": report_model.id,
        "title": report_model.title,
        "report_type": report_model.report_type,
        "sha256_hash": report_model.sha256_hash,
        "signature_hex": report_model.signature_hex,
        "download_url": f"/api/v1/reports/{report_model.id}/download",
        "generated_at": report_model.generated_at.isoformat()
    }


@router.get("")
async def list_reports(db: AsyncSession = Depends(get_db)):
    """Lists all generated incident reports."""
    result = await db.execute(select(IncidentReport).order_by(desc(IncidentReport.generated_at)))
    return result.scalars().all()


@router.get("/{report_id}/download")
async def download_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Downloads the signed PDF report file."""
    result = await db.execute(select(IncidentReport).where(IncidentReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=os.path.basename(report.file_path)
    )


@router.post("/verify")
async def verify_report_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies chain of custody and cryptographic integrity of an uploaded PDF report.
    Checks SHA-256 and validates Ed25519 signature against the Argus root authority.
    """
    content = await file.read()
    computed_sha256 = signer.calculate_sha256(content)
    public_key = signer.get_public_key_pem().strip()

    # Query registry by sha256
    stmt = select(IncidentReport).where(IncidentReport.sha256_hash == computed_sha256)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if report:
        # Validate cryptographic signature against document bytes
        sig_valid = signer.verify(content, report.signature_hex)
        return {
            "verified": sig_valid,
            "sha256_hash": computed_sha256,
            "expected_hash": report.sha256_hash,
            "signer_public_key": public_key,
            "signature_valid": sig_valid,
            "timestamp": report.generated_at.isoformat() if report.generated_at else None,
            "report_title": report.title,
            "generated_by": report.generated_by,
            "status": "VALID_AUTHENTIC_DOCUMENT" if sig_valid else "CORRUPTED_SIGNATURE",
            "message": "Cryptographic integrity intact. Document verified authentic against Argus root authority." if sig_valid else "Signature verification failed. Document content has been modified."
        }
    else:
        return {
            "verified": False,
            "sha256_hash": computed_sha256,
            "expected_hash": None,
            "signer_public_key": public_key,
            "signature_valid": False,
            "timestamp": None,
            "status": "UNREGISTERED_DOCUMENT",
            "error": "Document hash not found in Argus SOC audit registry. Not an authentic report.",
            "message": "No matching cryptographically signed incident report found."
        }
