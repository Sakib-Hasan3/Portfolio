from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class AdminRead(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class SessionResponse(BaseModel):
    user: AdminRead
    csrf_token: str
    access_expires_in: int


def validate_password_strength(v: str) -> str:
    if len(v) < 12:
        raise ValueError("Password must be at least 12 characters")
    classes = sum(
        [any(c.islower() for c in v), any(c.isupper() for c in v), any(c.isdigit() for c in v),
         any(not c.isalnum() for c in v)]
    )
    if classes < 3:
        raise ValueError("Use at least three of: lowercase, uppercase, digits, symbols")
    return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(max_length=256)

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        return validate_password_strength(v)


class AdminProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
