from typing import Optional
from pydantic import BaseModel
from app.schemas.role import UserRole


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
    type: Optional[str] = None
