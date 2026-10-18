import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.security import require_role, hash_password
from app.database.connection import get_collection
from app.schemas.auth import UserOut
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["User Administration"])

@router.get("", response_model=List[UserOut])
async def list_users(token_data: dict = Depends(require_role(["admin"]))):
    users_col = get_collection("users")
    cursor = users_col.find().sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [UserOut(**d) for d in docs]

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    token_data: dict = Depends(require_role(["admin"]))
):
    users_col = get_collection("users")
    email_clean = payload.email.lower().strip()
    
    existing = await users_col.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMAIL_EXISTS", "message": "A user with this email address already exists"}
        )

    now_str = datetime.now(timezone.utc).isoformat()
    new_user = {
        "_id": str(uuid.uuid4()),
        "name": payload.name,
        "email": email_clean,
        "password_hash": hash_password(payload.password),
        "role": payload.role if payload.role in ["admin", "operator"] else "operator",
        "is_active": True,
        "created_at": now_str,
        "updated_at": now_str,
        "last_login_at": None
    }
    await users_col.insert_one(new_user)

    # Log audit entry
    audit_col = get_collection("audit_logs")
    await audit_col.insert_one({
        "_id": str(uuid.uuid4()),
        "action": "USER_CREATED",
        "actor_id": token_data.get("sub"),
        "target_user_id": new_user["_id"],
        "timestamp": now_str
    })

    return UserOut(**new_user)

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    token_data: dict = Depends(require_role(["admin"]))
):
    users_col = get_collection("users")
    target_user = await users_col.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Protection: Prevent deactivating the last active administrator
    if payload.is_active is False and target_user.get("role") == "admin":
        active_admins = await users_col.count_documents({"role": "admin", "is_active": True})
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "CANNOT_DEACTIVATE_LAST_ADMIN", "message": "Cannot deactivate the only active system administrator"}
            )

    update_fields = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.role is not None and payload.role in ["admin", "operator"]:
        # If downgrading admin to operator, ensure at least one other admin remains
        if target_user.get("role") == "admin" and payload.role != "admin":
            active_admins = await users_col.count_documents({"role": "admin", "is_active": True})
            if active_admins <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "CANNOT_DEMOTE_LAST_ADMIN", "message": "Cannot change role of the only active system administrator"}
                )
        update_fields["role"] = payload.role
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active
    if payload.password:
        update_fields["password_hash"] = hash_password(payload.password)

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await users_col.update_one({"_id": user_id}, {"$set": update_fields})

    updated = await users_col.find_one({"_id": user_id})
    return UserOut(**updated)
