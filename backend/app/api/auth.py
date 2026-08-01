"""Auth API — one-time email OTP, then username/password login."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)
from app.core.config import get_settings
from app.core.learner_profile import (
    merge_learner_profile,
    profile_is_complete,
    sync_legacy_columns,
)
from app.core.otp import generate_otp, hash_otp, verify_otp_hash
from app.core.passwords import hash_password, validate_username, verify_password
from app.core.rate_limit import rate_limit_auth
from app.core.security import (
    create_access_token,
    create_refresh_token_payload,
    decode_token,
    get_current_user_id,
    hash_refresh_token,
)
from app.database.session import get_db
from app.models.entities import EmailOTP, Progress, RefreshToken, User
from app.models.schemas import (
    LoginBody,
    RefreshBody,
    RegisterBody,
    RequestOTPBody,
    SetupTokenResponse,
    TokenResponse,
    UserOut,
    UserProfileUpdate,
    VerifyOTPBody,
)
from app.services.email import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])

SETUP_TOKEN_MINUTES = 30
GENERIC_OTP_SENT = {"message": "If this email can be registered, a code was sent.", "email": ""}


async def _issue_session_tokens(db: AsyncSession, user: User) -> TokenResponse:
    access = create_access_token(str(user.id), extra={"email": user.email})
    from uuid import uuid4

    jti = str(uuid4())
    raw_refresh, expires = create_refresh_token_payload(str(user.id), jti)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=expires,
            revoked=False,
        )
    )
    await db.flush()
    return TokenResponse(
        access_token=access,
        refresh_token=raw_refresh,
        is_new_user=False,
        profile_complete=bool(user.profile_complete),
    )


def _attach_session_cookies(response: Response, tokens: TokenResponse) -> TokenResponse:
    set_auth_cookies(
        response,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )
    return tokens


def _refresh_token_from(request: Request, body: RefreshBody | None) -> str:
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE) or ""
    raw = raw.strip()
    if len(raw) < 20:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return raw


def _otp_matches(email: str, code: str, stored: str | None) -> bool:
    if not stored:
        return False
    # Only accept HMAC digests (64 hex chars). Legacy plaintext OTPs are rejected.
    if len(stored) == 64 and all(c in "0123456789abcdef" for c in stored.lower()):
        return verify_otp_hash(email, code, stored)
    return False


@router.post("/request-otp")
async def request_otp(
    body: RequestOTPBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a one-time code to verify email for new account setup."""
    settings = get_settings()
    email = body.email.lower().strip()
    rate_limit_auth(request, action="request-otp", email=email)

    existing = await db.execute(select(User).where(User.email == email))
    user = existing.scalar_one_or_none()
    # Anti-enumeration: always return the same shape.
    if user and user.password_hash:
        return {**GENERIC_OTP_SENT, "email": email}

    # Invalidate any prior unused codes for this email.
    prior = (
        await db.scalars(
            select(EmailOTP).where(EmailOTP.email == email, EmailOTP.used.is_(False))
        )
    ).all()
    for row in prior:
        row.used = True

    code = generate_otp()
    otp = EmailOTP(
        email=email,
        code=hash_otp(email, code),
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.otp_expire_minutes),
        used=False,
    )
    db.add(otp)
    await db.flush()
    await send_otp_email(email, code)
    return {**GENERIC_OTP_SENT, "email": email}


@router.post("/verify-email", response_model=SetupTokenResponse)
async def verify_email(
    body: VerifyOTPBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify email once. Creates a UUID user row, then returns a short-lived setup token."""
    email = body.email.lower().strip()
    rate_limit_auth(request, action="verify-email", email=email)

    result = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.used.is_(False))
        .order_by(EmailOTP.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    otp = result.scalar_one_or_none()
    if not otp or not _otp_matches(email, body.code, otp.code):
        raise HTTPException(status_code=400, detail="Invalid OTP")
    expires = otp.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    otp.used = True

    user_result = await db.execute(
        select(User).where(User.email == email).with_for_update()
    )
    user = user_result.scalar_one_or_none()

    if user and user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Account already exists. Please log in with email or username and password.",
        )

    if user is None:
        user = User(email=email, email_verified=True)
        db.add(user)
        await db.flush()
        db.add(Progress(user_id=user.id, learning_graph={}))
        await db.flush()
    else:
        user.email_verified = True
        prog_result = await db.execute(
            select(Progress).where(Progress.user_id == user.id)
        )
        if prog_result.scalar_one_or_none() is None:
            db.add(Progress(user_id=user.id, learning_graph={}))
        await db.flush()

    setup_token = create_access_token(
        str(user.id),
        extra={"email": user.email, "purpose": "setup"},
        expire_minutes=SETUP_TOKEN_MINUTES,
    )
    return SetupTokenResponse(
        setup_token=setup_token,
        user_id=user.id,
        email=user.email,
        email_verified=True,
        needs_account=True,
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterBody,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Create username + password after email verification."""
    rate_limit_auth(request, action="register")
    if body.password != body.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    payload = decode_token(body.setup_token)
    if payload.get("purpose") != "setup":
        raise HTTPException(status_code=400, detail="Invalid setup token")
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid setup token") from exc

    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token_email = (payload.get("email") or "").lower().strip()
    if token_email and token_email != user.email.lower():
        raise HTTPException(status_code=400, detail="Invalid setup token")
    if user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Account already set up. Please log in.",
        )

    try:
        username = validate_username(body.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    taken = await db.execute(
        select(User).where(func.lower(User.username) == username, User.id != user.id)
    )
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    user.username = username
    user.password_hash = hash_password(body.password)
    user.email_verified = True
    await db.flush()

    tokens = await _issue_session_tokens(db, user)
    out = TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        is_new_user=True,
        profile_complete=bool(user.profile_complete),
    )
    return _attach_session_cookies(response, out)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginBody,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Log in with username or email + password."""
    identifier = body.identifier.strip()
    rate_limit_auth(
        request,
        action="login",
        email=identifier.lower() if identifier else None,
    )
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or username required")

    if "@" in identifier:
        result = await db.execute(
            select(User).where(User.email == identifier.lower())
        )
    else:
        result = await db.execute(
            select(User).where(func.lower(User.username) == identifier.lower())
        )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=400,
            detail="Email not verified. Create your account with the email code first.",
        )

    tokens = await _issue_session_tokens(db, user)
    out = TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        is_new_user=False,
        profile_complete=bool(user.profile_complete),
    )
    return _attach_session_cookies(response, out)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_session(
    request: Request,
    response: Response,
    body: RefreshBody = Body(default_factory=RefreshBody),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_auth(request, action="refresh")
    raw = _refresh_token_from(request, body)
    digest = hash_refresh_token(raw)
    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == digest)
        .with_for_update()
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        not row
        or row.revoked
        or (row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at)
        < now
    ):
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    user = await db.get(User, row.user_id)
    if not user:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Rotate: revoke old, mint new pair
    row.revoked = True
    tokens = await _issue_session_tokens(db, user)
    return _attach_session_cookies(response, tokens)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    body: RefreshBody = Body(default_factory=RefreshBody),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the refresh token (body or cookie) and clear session cookies."""
    try:
        raw = _refresh_token_from(request, body)
    except HTTPException:
        clear_auth_cookies(response)
        return {"ok": True}
    digest = hash_refresh_token(raw)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == digest))
    row = result.scalar_one_or_none()
    if row:
        row.revoked = True
    clear_auth_cookies(response)
    return {"ok": True}


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
    profile_patch = data.pop("learner_profile", None)
    for key, value in data.items():
        setattr(user, key, value)

    if profile_patch is not None:
        user.learner_profile = merge_learner_profile(user.learner_profile, profile_patch)
        legacy = sync_legacy_columns(user.learner_profile)
        for key, value in legacy.items():
            if value is not None:
                setattr(user, key, value)

    user.profile_complete = profile_is_complete(user.name, user.learner_profile)
    await db.flush()
    return user
