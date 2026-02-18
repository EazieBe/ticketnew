"""
Logging and error tracking endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from datetime import datetime, timezone
import json
import logging
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api", tags=["logging"])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.post("/logs")
async def log_frontend_error(
    log_data: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receive and store frontend error logs
    """
    try:
        # Extract client information
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "")
        
        # Create log entry
        log_entry = models.FrontendLog(
            timestamp=datetime.now(timezone.utc),
            level=log_data.get("level", "INFO"),
            context=log_data.get("context", "frontend"),
            message=log_data.get("message", ""),
            data=json.dumps(log_data.get("data", {})),
            url=log_data.get("url", ""),
            user_agent=user_agent,
            client_ip=client_ip,
            error_id=log_data.get("errorId")
        )
        
        db.add(log_entry)
        db.commit()
        
        # Also log to application logger
        log_level = getattr(logging, log_data.get("level", "INFO").upper(), logging.INFO)
        logger.log(
            log_level,
            f"Frontend {log_data.get('level', 'INFO')}: {log_data.get('message', '')}",
            extra={
                "context": log_data.get("context", "frontend"),
                "data": log_data.get("data", {}),
                "url": log_data.get("url", ""),
                "error_id": log_data.get("errorId")
            }
        )
        
        return {"status": "logged", "error_id": log_data.get("errorId")}
        
    except Exception as e:
        logger.error(f"Failed to log frontend error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log error")

@router.post("/errors")
async def log_frontend_error_detailed(
    error_data: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receive and store detailed frontend error information
    """
    try:
        # Extract client information
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "")
        
        # Create error entry
        error_entry = models.FrontendError(
            timestamp=datetime.now(timezone.utc),
            error_id=error_data.get("errorId"),
            message=error_data.get("message", ""),
            stack=error_data.get("stack", ""),
            component_stack=error_data.get("componentStack", ""),
            url=error_data.get("url", ""),
            user_agent=user_agent,
            client_ip=client_ip,
            additional_data=json.dumps(error_data.get("additionalData", {}))
        )
        
        db.add(error_entry)
        db.commit()
        
        # Log to application logger
        logger.error(
            f"Frontend Error: {error_data.get('message', '')}",
            extra={
                "error_id": error_data.get("errorId"),
                "stack": error_data.get("stack", ""),
                "url": error_data.get("url", ""),
                "client_ip": client_ip
            }
        )
        
        return {"status": "logged", "error_id": error_data.get("errorId")}
        
    except Exception as e:
        logger.error(f"Failed to log frontend error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log error")

@router.get("/logs/stats")
async def get_log_stats(
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Get logging statistics for the specified time period
    """
    try:
        from datetime import timedelta
        
        # Calculate time range
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)
        
        # Query logs
        logs = db.query(models.FrontendLog).filter(
            models.FrontendLog.timestamp >= start_time,
            models.FrontendLog.timestamp <= end_time
        ).all()
        
        # Calculate statistics
        stats = {
            "total_logs": len(logs),
            "by_level": {},
            "by_context": {},
            "by_hour": {},
            "error_rate": 0
        }
        
        error_count = 0
        
        for log in logs:
            # Count by level
            level = log.level
            stats["by_level"][level] = stats["by_level"].get(level, 0) + 1
            
            # Count by context
            context = log.context
            stats["by_context"][context] = stats["by_context"].get(context, 0) + 1
            
            # Count by hour
            hour = log.timestamp.hour
            stats["by_hour"][hour] = stats["by_hour"].get(hour, 0) + 1
            
            # Count errors
            if level in ["ERROR", "WARN"]:
                error_count += 1
        
        # Calculate error rate
        if len(logs) > 0:
            stats["error_rate"] = (error_count / len(logs)) * 100
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get log stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get log statistics")

@router.get("/logs/recent")
async def get_recent_logs(
    limit: int = 100,
    level: Optional[str] = None,
    context: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get recent log entries with optional filtering
    """
    try:
        query = db.query(models.FrontendLog)
        
        # Apply filters
        if level:
            query = query.filter(models.FrontendLog.level == level.upper())
        if context:
            query = query.filter(models.FrontendLog.context == context)
        
        # Order by timestamp descending and limit
        logs = query.order_by(models.FrontendLog.timestamp.desc()).limit(limit).all()
        
        # Convert to response format
        log_entries = []
        for log in logs:
            log_entries.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "level": log.level,
                "context": log.context,
                "message": log.message,
                "data": json.loads(log.data) if log.data else {},
                "url": log.url,
                "error_id": log.error_id
            })
        
        return {"logs": log_entries, "count": len(log_entries)}
        
    except Exception as e:
        logger.error(f"Failed to get recent logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get recent logs")

@router.get("/errors/recent")
async def get_recent_errors(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get recent error entries
    """
    try:
        errors = db.query(models.FrontendError).order_by(
            models.FrontendError.timestamp.desc()
        ).limit(limit).all()
        
        # Convert to response format
        error_entries = []
        for error in errors:
            error_entries.append({
                "id": error.id,
                "timestamp": error.timestamp.isoformat(),
                "error_id": error.error_id,
                "message": error.message,
                "stack": error.stack,
                "component_stack": error.component_stack,
                "url": error.url,
                "client_ip": error.client_ip,
                "additional_data": json.loads(error.additional_data) if error.additional_data else {}
            })
        
        return {"errors": error_entries, "count": len(error_entries)}
        
    except Exception as e:
        logger.error(f"Failed to get recent errors: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get recent errors")
