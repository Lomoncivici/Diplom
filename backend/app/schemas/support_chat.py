from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SupportUserInfo(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


class SupportMessageResponse(BaseModel):
    id: int
    conversation_id: int
    author_id: int
    author_name: str
    is_from_admin: bool
    text: str
    created_at: datetime


class SupportConversationSummary(BaseModel):
    id: int
    status: str
    unread_for_admin: int
    unread_for_user: int
    messages_count: int
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    assigned_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    user: SupportUserInfo
    assigned_admin: SupportUserInfo | None = None


class SupportConversationDetail(SupportConversationSummary):
    messages: list[SupportMessageResponse]


class SupportMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Текст сообщения не должен быть пустым")
        return normalized
