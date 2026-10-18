import csv
import io
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Response
from fastapi.responses import StreamingResponse
from app.core.security import get_current_user_token_data
from app.database.connection import get_collection
from app.schemas.event import EventListResponse, EventOut

router = APIRouter(prefix="/events", tags=["Events & Alerts"])

@router.get("", response_model=EventListResponse)
async def list_events(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    token_data: dict = Depends(get_current_user_token_data)
):
    events_col = get_collection("events")
    query = {}

    if camera_id:
        query["camera_id"] = camera_id
    if source_type:
        query["source_type"] = source_type
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        query["processed_at"] = date_q

    if status and status != "all":
        if status == "no_mask":
            query["labels_summary.no_mask"] = {"$gt": 0}
        elif status == "mask":
            query["labels_summary.mask"] = {"$gt": 0}

    if search:
        query["$or"] = [
            {"camera_name": {"$regex": search, "$options": "i"}},
            {"request_id": {"$regex": search, "$options": "i"}},
            {"severity": {"$regex": search, "$options": "i"}}
        ]

    total = await events_col.count_documents(query)
    skip = (page - 1) * limit
    cursor = events_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    return EventListResponse(
        events=[EventOut(**doc) for doc in docs],
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit if total > 0 else 1
    )

@router.get("/export")
async def export_events_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    token_data: dict = Depends(get_current_user_token_data)
):
    events_col = get_collection("events")
    query = {}
    if camera_id:
        query["camera_id"] = camera_id
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        query["processed_at"] = date_q

    cursor = events_col.find(query).sort("created_at", -1)
    docs = await cursor.to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Request ID", "Camera Name", "Source Type", "Processed At (UTC)",
        "Mask Count", "No-Mask Count", "Uncertain Count", "Confidence Score",
        "Severity", "Acknowledged", "Acknowledged At"
    ])

    for doc in docs:
        labels = doc.get("labels_summary", {})
        writer.writerow([
            doc.get("_id"),
            doc.get("request_id"),
            doc.get("camera_name", "N/A"),
            doc.get("source_type"),
            doc.get("processed_at"),
            labels.get("mask", 0),
            labels.get("no_mask", 0),
            labels.get("uncertain", 0),
            doc.get("confidence_summary", 0.0),
            doc.get("severity", "warning"),
            doc.get("acknowledged", False),
            doc.get("acknowledged_at", "")
        ])

    output.seek(0)
    filename = f"maskguard_events_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str, token_data: dict = Depends(get_current_user_token_data)):
    events_col = get_collection("events")
    event = await events_col.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventOut(**event)

@router.patch("/{event_id}/acknowledge", response_model=EventOut)
async def acknowledge_event(event_id: str, token_data: dict = Depends(get_current_user_token_data)):
    events_col = get_collection("events")
    now_str = datetime.now(timezone.utc).isoformat()
    user_id = token_data.get("sub")

    res = await events_col.update_one(
        {"_id": event_id},
        {"$set": {
            "acknowledged": True,
            "acknowledged_at": now_str,
            "acknowledged_by": user_id
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    updated = await events_col.find_one({"_id": event_id})
    return EventOut(**updated)
