"""Auth API — email OTP login, JWT issuance, learner profile."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, get_current_user_id
from app.database.session import get_db
from app.models.entities import EmailOTP, Progress, User
from app.models.schemas import (
    RequestOTPBody,
    TokenResponse,
    UserOut,
    UserProfileUpdate,
    VerifyOTPBody,
)
from app.services.email import generate_otp, send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp")
async def request_otp(body: RequestOTPBody, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    code = generate_otp()
    otp = EmailOTP(
        email=body.email.lower().strip(),
        code=code,
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.otp_expire_minutes),
        used=False,
    )
    db.add(otp)
    await db.flush()
    await send_otp_email(otp.email, code)
    return {"message": "OTP sent to email", "email": otp.email}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: VerifyOTPBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()
    result = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.used.is_(False))
        .order_by(EmailOTP.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()
    if not otp or otp.code != body.code.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP")
    expires = otp.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    otp.used = True
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    is_new = False
    if user is None:
        is_new = True
        user = User(email=email)
        db.add(user)
        await db.flush()
        db.add(Progress(user_id=user.id, learning_graph={}))
        await db.flush()

    token = create_access_token(str(user.id), extra={"email": user.email})
    return TokenResponse(
        access_token=token,
        is_new_user=is_new,
        profile_complete=bool(user.profile_complete),
    )


@router.get("/me", response_model=UserOut)
async def me(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserOut)
async def update_profile(
    body: UserProfileUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    required = [
        user.name,
        user.age,
        user.school_class,
        user.likes,
        user.favorites,
    ]
    user.profile_complete = all(v is not None and str(v).strip() != "" for v in required)
    await db.flush()
    return user
