import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.config import settings
from app.core.security import verify_password, hash_password, create_access_token, get_current_user_token_data
from app.database.connection import get_collection
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    users_col = get_collection("users")
    user = await users_col.find_one({"email": payload.email.lower().strip()})
    
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Incorrect email or password"}
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_DISABLED", "message": "This account has been deactivated"}
        )

    # Update last login
    now_str = datetime.now(timezone.utc).isoformat()
    await users_col.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now_str}})
    user["last_login_at"] = now_str

    token = create_access_token(subject=user["_id"], role=user.get("role", "operator"))
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut(**user)
    )

@router.post("/logout")
async def logout(token_data: dict = Depends(get_current_user_token_data)):
    # With stateless JWT, client deletes token; server returns clear confirmation
    return {"status": "success", "message": "Successfully logged out"}

@router.get("/me", response_model=UserOut)
async def get_current_user(token_data: dict = Depends(get_current_user_token_data)):
    users_col = get_collection("users")
    user = await users_col.find_one({"_id": token_data.get("sub")})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User record not found"}
        )
    return UserOut(**user)

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    token_data: dict = Depends(get_current_user_token_data)
):
    users_col = get_collection("users")
    user = await users_col.find_one({"_id": token_data.get("sub")})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if not verify_password(payload.old_password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INCORRECT_OLD_PASSWORD", "message": "Current password does not match"}
        )
        
    new_hash = hash_password(payload.new_password)
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success", "message": "Password changed successfully"}
