from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage
from app.models.user import User
from app.schemas.support_chat import (
    SupportConversationDetail,
    SupportConversationSummary,
    SupportMessageCreate,
    SupportMessageResponse,
)

router = APIRouter(prefix="/support", tags=["support"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_message_response(message: SupportMessage) -> SupportMessageResponse:
    return SupportMessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        author_id=message.author_id,
        author_name=message.author.full_name if message.author else "Пользователь",
        is_from_admin=message.is_from_admin,
        text=message.text,
        created_at=message.created_at,
    )


def _build_conversation_summary(conversation: SupportConversation) -> SupportConversationSummary:
    return SupportConversationSummary(
        id=conversation.id,
        status=conversation.status,
        unread_for_admin=conversation.unread_for_admin,
        unread_for_user=conversation.unread_for_user,
        messages_count=len(conversation.messages),
        last_message_preview=conversation.last_message_preview,
        last_message_at=conversation.last_message_at,
        assigned_at=conversation.assigned_at,
        closed_at=conversation.closed_at,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        user=conversation.user,
        assigned_admin=conversation.assigned_admin,
    )


def _build_conversation_detail(conversation: SupportConversation) -> SupportConversationDetail:
    summary = _build_conversation_summary(conversation)
    return SupportConversationDetail(
        **summary.model_dump(),
        messages=[_build_message_response(message) for message in conversation.messages],
    )


def _truncate_preview(text: str) -> str:
    text = text.strip()
    if len(text) <= 220:
        return text
    return f"{text[:217].rstrip()}..."


def _base_conversation_query():
    return (
        select(SupportConversation)
        .options(
            joinedload(SupportConversation.user),
            joinedload(SupportConversation.assigned_admin),
            selectinload(SupportConversation.messages).joinedload(SupportMessage.author),
        )
    )


def _list_conversations_for_user(db: Session, user_id: int) -> list[SupportConversation]:
    stmt = (
        _base_conversation_query()
        .where(SupportConversation.user_id == user_id)
        .order_by(SupportConversation.created_at.desc())
    )
    return list(db.scalars(stmt).unique().all())


def _load_conversation_for_user(db: Session, user_id: int, conversation_id: int) -> SupportConversation | None:
    stmt = _base_conversation_query().where(
        SupportConversation.user_id == user_id,
        SupportConversation.id == conversation_id,
    )
    return db.scalar(stmt)


def _load_conversation_for_admin(db: Session, conversation_id: int) -> SupportConversation | None:
    stmt = _base_conversation_query().where(SupportConversation.id == conversation_id)
    return db.scalar(stmt)


def _get_open_conversation_for_user(db: Session, user_id: int) -> SupportConversation | None:
    stmt = (
        _base_conversation_query()
        .where(SupportConversation.user_id == user_id, SupportConversation.status == "open")
        .order_by(SupportConversation.created_at.desc())
    )
    return db.scalar(stmt)


def _assert_conversation_is_open(conversation: SupportConversation) -> None:
    if conversation.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Этот чат уже закрыт. Чтобы продолжить общение, откройте новый чат.",
        )


def _assert_admin_can_manage_conversation(conversation: SupportConversation, admin_user: User) -> None:
    if conversation.assigned_admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Сначала возьмите этот чат в работу.",
        )

    if conversation.assigned_admin_id != admin_user.id:
        admin_name = conversation.assigned_admin.full_name if conversation.assigned_admin else "другим администратором"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Этот чат уже закреплён за администратором ({admin_name}).",
        )


@router.get("/my/conversations", response_model=list[SupportConversationSummary])
def list_my_support_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Администратор работает с чатами поддержки через общий раздел")

    conversations = _list_conversations_for_user(db, current_user.id)
    return [_build_conversation_summary(conversation) for conversation in conversations]


@router.post("/my/conversations", response_model=SupportConversationDetail, status_code=status.HTTP_201_CREATED)
def create_my_support_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Администратор не создаёт пользовательские чаты")

    existing_open = _get_open_conversation_for_user(db, current_user.id)
    if existing_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала завершите текущий открытый чат с поддержкой.",
        )

    conversation = SupportConversation(user_id=current_user.id, status="open")
    db.add(conversation)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала завершите текущий открытый чат с поддержкой.",
        ) from exc

    conversation = _load_conversation_for_user(db, current_user.id, conversation.id)
    return _build_conversation_detail(conversation)


@router.get("/my/conversations/{conversation_id}", response_model=SupportConversationDetail)
def get_my_support_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Администратор работает с чатами поддержки через общий раздел")

    conversation = _load_conversation_for_user(db, current_user.id, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")

    if conversation.unread_for_user:
        conversation.unread_for_user = 0
        db.commit()
        conversation = _load_conversation_for_user(db, current_user.id, conversation_id)

    return _build_conversation_detail(conversation)


@router.post("/my/conversations/{conversation_id}/messages", response_model=SupportConversationDetail, status_code=status.HTTP_201_CREATED)
def send_message_to_support(
    conversation_id: int,
    payload: SupportMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Администратор отвечает через общий раздел чатов")

    conversation = _load_conversation_for_user(db, current_user.id, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")
    _assert_conversation_is_open(conversation)

    message = SupportMessage(
        conversation_id=conversation.id,
        author_id=current_user.id,
        is_from_admin=False,
        text=payload.text,
    )
    db.add(message)

    conversation.last_message_preview = _truncate_preview(payload.text)
    conversation.last_message_at = _utc_now()
    conversation.unread_for_admin += 1

    db.commit()
    conversation = _load_conversation_for_user(db, current_user.id, conversation_id)
    return _build_conversation_detail(conversation)


@router.get("/conversations", response_model=list[SupportConversationSummary])
def list_support_conversations(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = (
        _base_conversation_query()
        .order_by(
            SupportConversation.status.asc(),
            SupportConversation.last_message_at.desc().nullslast(),
            SupportConversation.created_at.desc(),
        )
    )
    conversations = list(db.scalars(stmt).unique().all())
    return [_build_conversation_summary(conversation) for conversation in conversations]


@router.get("/conversations/{conversation_id}", response_model=SupportConversationDetail)
def get_support_conversation(
    conversation_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")

    if conversation.unread_for_admin:
        conversation.unread_for_admin = 0
        db.commit()
        conversation = _load_conversation_for_admin(db, conversation_id)

    return _build_conversation_detail(conversation)


@router.put("/conversations/{conversation_id}/take", response_model=SupportConversationDetail)
def take_support_conversation(
    conversation_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")
    _assert_conversation_is_open(conversation)

    if conversation.assigned_admin_id and conversation.assigned_admin_id != admin_user.id:
        admin_name = conversation.assigned_admin.full_name if conversation.assigned_admin else "другим администратором"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Этот чат уже закреплён за администратором ({admin_name}).",
        )

    if conversation.assigned_admin_id == admin_user.id:
        return _build_conversation_detail(conversation)

    conversation.assigned_admin_id = admin_user.id
    conversation.assigned_at = _utc_now()
    db.commit()
    conversation = _load_conversation_for_admin(db, conversation_id)
    return _build_conversation_detail(conversation)


@router.put("/conversations/{conversation_id}/release", response_model=SupportConversationDetail)
def release_support_conversation(
    conversation_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")

    if conversation.assigned_admin_id is None:
        return _build_conversation_detail(conversation)

    if conversation.assigned_admin_id != admin_user.id:
        admin_name = conversation.assigned_admin.full_name if conversation.assigned_admin else "другим администратором"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Снять с работы можно только чат, который закреплён за вами. Сейчас чат закреплён за ({admin_name}).",
        )

    if conversation.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Закрытый чат нельзя снять с работы. Он остаётся закреплённым для истории переписки.",
        )

    conversation.assigned_admin_id = None
    conversation.assigned_at = None
    db.commit()
    conversation = _load_conversation_for_admin(db, conversation_id)
    return _build_conversation_detail(conversation)


@router.post("/conversations/{conversation_id}/messages", response_model=SupportConversationDetail, status_code=status.HTTP_201_CREATED)
def send_support_reply(
    conversation_id: int,
    payload: SupportMessageCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")
    _assert_conversation_is_open(conversation)
    _assert_admin_can_manage_conversation(conversation, admin_user)

    message = SupportMessage(
        conversation_id=conversation.id,
        author_id=admin_user.id,
        is_from_admin=True,
        text=payload.text,
    )
    db.add(message)

    conversation.last_message_preview = _truncate_preview(payload.text)
    conversation.last_message_at = _utc_now()
    conversation.unread_for_user += 1

    db.commit()
    conversation = _load_conversation_for_admin(db, conversation_id)
    return _build_conversation_detail(conversation)


@router.put("/conversations/{conversation_id}/close", response_model=SupportConversationDetail)
def close_support_conversation(
    conversation_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")

    if conversation.status == "closed":
        return _build_conversation_detail(conversation)

    _assert_admin_can_manage_conversation(conversation, admin_user)
    conversation.status = "closed"
    conversation.closed_at = _utc_now()
    db.commit()
    conversation = _load_conversation_for_admin(db, conversation_id)
    return _build_conversation_detail(conversation)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_support_conversation(
    conversation_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conversation = _load_conversation_for_admin(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Чат поддержки не найден")

    db.delete(conversation)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
