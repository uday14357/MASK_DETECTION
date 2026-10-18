from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user_token_data
from app.database.connection import get_collection
from app.schemas.analytics import (
    AnalyticsSummary, TrendPoint, CameraStat,
    AnalyticsTrendsResponse, AnalyticsCamerasResponse
)

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    days: int = Query(7, ge=1, le=90),
    token_data: dict = Depends(get_current_user_token_data)
):
    events_col = get_collection("events")
    cameras_col = get_collection("cameras")

    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cursor = events_col.find({"created_at": {"$gte": since_date}})
    events = await cursor.to_list(10000)

    total_events = len(events)
    mask_count = 0
    no_mask_count = 0
    uncertain_count = 0
    unacknowledged = 0

    for ev in events:
        labels = ev.get("labels_summary", {})
        mask_count += labels.get("mask", 0)
        no_mask_count += labels.get("no_mask", 0)
        uncertain_count += labels.get("uncertain", 0)
        if not ev.get("acknowledged", False):
            unacknowledged += 1

    total_faces = mask_count + no_mask_count + uncertain_count
    classified = mask_count + no_mask_count
    mask_pct = round((mask_count / classified) * 100.0, 2) if classified > 0 else 0.0

    registered_cams = await cameras_col.count_documents({})

    return AnalyticsSummary(
        total_events=total_events,
        total_faces=total_faces,
        mask_detected_count=mask_count,
        no_mask_detected_count=no_mask_count,
        uncertain_count=uncertain_count,
        mask_percentage=mask_pct,
        registered_cameras=registered_cams,
        unacknowledged_alerts=unacknowledged,
        timeframe=f"last_{days}_days"
    )

@router.get("/trends", response_model=AnalyticsTrendsResponse)
async def get_analytics_trends(
    days: int = Query(7, ge=1, le=90),
    token_data: dict = Depends(get_current_user_token_data)
):
    events_col = get_collection("events")
    now = datetime.now(timezone.utc)
    since_date = (now - timedelta(days=days)).isoformat()
    
    cursor = events_col.find({"created_at": {"$gte": since_date}})
    events = await cursor.to_list(10000)

    # Initialize all dates in range with 0 counts
    date_map = {}
    for i in range(days - 1, -1, -1):
        d_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        date_map[d_str] = {"mask": 0, "no_mask": 0, "uncertain": 0}

    for ev in events:
        created_str = ev.get("created_at", "")[:10]
        if created_str in date_map:
            labels = ev.get("labels_summary", {})
            date_map[created_str]["mask"] += labels.get("mask", 0)
            date_map[created_str]["no_mask"] += labels.get("no_mask", 0)
            date_map[created_str]["uncertain"] += labels.get("uncertain", 0)

    trends: List[TrendPoint] = []
    for d_str, counts in sorted(date_map.items()):
        m = counts["mask"]
        nm = counts["no_mask"]
        u = counts["uncertain"]
        tot = m + nm + u
        classified = m + nm
        pct = round((m / classified) * 100.0, 2) if classified > 0 else 0.0
        trends.append(TrendPoint(
            date=d_str,
            mask=m,
            no_mask=nm,
            uncertain=u,
            total=tot,
            mask_percentage=pct
        ))

    return AnalyticsTrendsResponse(trends=trends, timeframe=f"last_{days}_days")

@router.get("/cameras", response_model=AnalyticsCamerasResponse)
async def get_camera_analytics(token_data: dict = Depends(get_current_user_token_data)):
    cameras_col = get_collection("cameras")
    events_col = get_collection("events")

    cameras = await cameras_col.find().to_list(100)
    events = await events_col.find().to_list(10000)

    # Aggregate by camera
    cam_events = defaultdict(list)
    for ev in events:
        cid = ev.get("camera_id") or "unassigned"
        cam_events[cid].append(ev)

    results: List[CameraStat] = []
    for c in cameras:
        cid = c["_id"]
        evs = cam_events.get(cid, [])
        m = sum(e.get("labels_summary", {}).get("mask", 0) for e in evs)
        nm = sum(e.get("labels_summary", {}).get("no_mask", 0) for e in evs)
        classified = m + nm
        pct = round((m / classified) * 100.0, 2) if classified > 0 else 0.0

        results.append(CameraStat(
            camera_id=cid,
            camera_name=c.get("name", "Unknown"),
            total_events=len(evs),
            mask_count=m,
            no_mask_count=nm,
            mask_percentage=pct,
            status=c.get("status", "active")
        ))

    return AnalyticsCamerasResponse(cameras=results)
