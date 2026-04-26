import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeSupportConversation,
  createMySupportConversation,
  getMySupportConversation,
  getMySupportConversations,
  getSupportConversation,
  getSupportConversations,
  releaseSupportConversation,
  sendMessageToSupport,
  sendSupportReply,
  takeSupportConversation,
} from '../api'
import FormGuide from '../components/FormGuide'
import { getErrorMessage } from '../utils/apiErrors'

function formatDateTime(value) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getChatTitle(conversation) {
  return `Чат № ${conversation.id}`
}

function getChatStatusLabel(status) {
  return status === 'closed' ? 'Закрыт' : 'Открыт'
}

function getUnreadCount(conversation, isAdmin) {
  return isAdmin ? (conversation.unread_for_admin || 0) : (conversation.unread_for_user || 0)
}

function getAdminQueueType(conversation, currentAdminId) {
  if (conversation.status === 'closed') {
    return 'closed'
  }

  if (!conversation.assigned_admin) {
    return 'free'
  }

  if (conversation.assigned_admin.id === currentAdminId) {
    return 'mine'
  }

  return 'busy'
}

function getQueueLabel(queueType) {
  if (queueType === 'mine') return 'Мой'
  if (queueType === 'free') return 'Свободный'
  if (queueType === 'busy') return 'Занят'
  return 'Закрыт'
}

function buildSupportGuideItems(isAdmin) {
  if (isAdmin) {
    return [
      {
        label: 'Очередь чатов',
        text: 'Слева отображаются все обращения. Фильтры помогают быстро отделить свободные, ваши и уже закрытые чаты.',
      },
      {
        label: 'Взять чат',
        text: 'Перед ответом администратор должен взять чат в работу. Это защищает диалог от ситуации, когда один чат ведут сразу несколько администраторов.',
      },
      {
        label: 'Закрытие обращения',
        text: 'После закрытия чат становится доступен только для чтения, а пользователь может создать новое обращение.',
      },
    ]
  }

  return [
    {
      label: 'Новый чат',
      text: 'Если открытого обращения нет, можно создать новый чат и написать администратору.',
    },
    {
      label: 'Закрытый чат',
      text: 'После закрытия старого обращения переписка в нём недоступна, но история сообщений сохраняется.',
    },
    {
      label: 'Автообновление',
      text: 'Список чатов и сообщения обновляются автоматически, поэтому новые ответы появляются без перезагрузки страницы.',
    },
  ]
}

function sortConversations(items, isAdmin, currentAdminId) {
  return [...items].sort((left, right) => {
    if (isAdmin) {
      const order = { free: 0, mine: 1, busy: 2, closed: 3 }
      const leftType = getAdminQueueType(left, currentAdminId)
      const rightType = getAdminQueueType(right, currentAdminId)
      if (leftType !== rightType) {
        return order[leftType] - order[rightType]
      }
    } else if (left.status !== right.status) {
      return left.status === 'open' ? -1 : 1
    }

    const leftDate = left.last_message_at || left.created_at || ''
    const rightDate = right.last_message_at || right.created_at || ''
    return String(rightDate).localeCompare(String(leftDate))
  })
}

export default function SupportPage({ user, onBack }) {
  const isAdmin = user?.role === 'admin'
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [listError, setListError] = useState('')
  const [conversationError, setConversationError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [messageText, setMessageText] = useState('')
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [closingConversation, setClosingConversation] = useState(false)
  const [takingConversation, setTakingConversation] = useState(false)
  const [releasingConversation, setReleasingConversation] = useState(false)
  const [adminFilter, setAdminFilter] = useState('all')

  const sortedConversations = useMemo(
    () => sortConversations(conversations, isAdmin, user?.id),
    [conversations, isAdmin, user?.id],
  )

  const filteredConversations = useMemo(() => {
    if (!isAdmin || adminFilter === 'all') {
      return sortedConversations
    }

    return sortedConversations.filter((conversation) => getAdminQueueType(conversation, user?.id) === adminFilter)
  }, [adminFilter, isAdmin, sortedConversations, user?.id])

  const adminCounters = useMemo(() => {
    const counters = { free: 0, mine: 0, busy: 0, closed: 0 }

    if (!isAdmin) {
      return counters
    }

    for (const conversation of conversations) {
      counters[getAdminQueueType(conversation, user?.id)] += 1
    }

    return counters
  }, [conversations, isAdmin, user?.id])

  const hasOpenConversation = useMemo(
    () => conversations.some((conversation) => conversation.status === 'open'),
    [conversations],
  )

  const refreshConversations = useCallback(async ({ keepSelection = true } = {}) => {
    try {
      if (!keepSelection) {
        setLoadingList(true)
      }
      setListError('')
      const nextConversations = isAdmin
        ? await getSupportConversations()
        : await getMySupportConversations()
      setConversations(nextConversations)

      setSelectedConversationId((previousId) => {
        const ordered = sortConversations(nextConversations, isAdmin, user?.id)
        const activeId = keepSelection ? previousId : null
        if (activeId && ordered.some((item) => item.id === activeId)) {
          return activeId
        }
        return ordered[0]?.id ?? null
      })
    } catch (err) {
      setListError(getErrorMessage(err, 'Не удалось загрузить список чатов поддержки.'))
    } finally {
      setLoadingList(false)
    }
  }, [isAdmin, user?.id])

  const refreshSelectedConversation = useCallback(async (conversationId = selectedConversationId) => {
    if (!conversationId) {
      setSelectedConversation(null)
      return
    }

    setLoadingConversation(true)
    setConversationError('')

    try {
      const nextConversation = isAdmin
        ? await getSupportConversation(conversationId)
        : await getMySupportConversation(conversationId)

      setSelectedConversation(nextConversation)
      setConversations((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== nextConversation.id)
        return [...withoutCurrent, nextConversation]
      })
    } catch (err) {
      setConversationError(getErrorMessage(err, 'Не удалось загрузить сообщения чата.'))
    } finally {
      setLoadingConversation(false)
    }
  }, [isAdmin, selectedConversationId])

  useEffect(() => {
    refreshConversations({ keepSelection: false })
  }, [refreshConversations])

  useEffect(() => {
    refreshSelectedConversation()
  }, [selectedConversationId, refreshSelectedConversation])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshConversations()
      if (selectedConversationId) {
        refreshSelectedConversation(selectedConversationId)
      }
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshConversations, refreshSelectedConversation, selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) {
      return
    }

    if (filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
      return
    }

    setSelectedConversationId(filteredConversations[0]?.id ?? null)
  }, [filteredConversations, selectedConversationId])

  async function handleCreateConversation() {
    setCreatingConversation(true)
    setActionError('')
    setActionMessage('')

    try {
      const conversation = await createMySupportConversation()
      setActionMessage('Новый чат создан.')
      setMessageText('')
      setSelectedConversationId(conversation.id)
      setSelectedConversation(conversation)
      await refreshConversations({ keepSelection: true })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Не удалось создать новый чат.'))
    } finally {
      setCreatingConversation(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    if (!selectedConversationId) {
      setActionError('Сначала выберите чат.')
      return
    }

    const normalizedText = messageText.trim()
    if (!normalizedText) {
      setActionError('Введите сообщение перед отправкой.')
      return
    }

    if (isAdmin && !selectedConversationMine) {
      setActionError(selectedConversationFree ? 'Сначала возьмите чат в работу.' : 'Отвечать может только администратор, который ведёт этот чат.')
      return
    }

    setSendingMessage(true)
    setActionError('')
    setActionMessage('')

    try {
      const conversation = isAdmin
        ? await sendSupportReply(selectedConversationId, normalizedText)
        : await sendMessageToSupport(selectedConversationId, normalizedText)

      setMessageText('')
      setSelectedConversation(conversation)
      setConversations((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id)
        return [...withoutCurrent, conversation]
      })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Не удалось отправить сообщение.'))
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleCloseConversation() {
    if (!selectedConversationId) return

    const confirmed = window.confirm('Закрыть этот чат поддержки? После закрытия продолжить переписку в нём будет нельзя.')
    if (!confirmed) return

    setClosingConversation(true)
    setActionError('')
    setActionMessage('')

    try {
      const conversation = await closeSupportConversation(selectedConversationId)
      setSelectedConversation(conversation)
      setConversations((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id)
        return [...withoutCurrent, conversation]
      })
      setActionMessage('Чат закрыт. Пользователь сможет открыть новый чат.')
    } catch (err) {
      setActionError(getErrorMessage(err, 'Не удалось закрыть чат.'))
    } finally {
      setClosingConversation(false)
    }
  }

  async function handleTakeConversation() {
    if (!selectedConversationId) return

    setTakingConversation(true)
    setActionError('')
    setActionMessage('')

    try {
      const conversation = await takeSupportConversation(selectedConversationId)
      setSelectedConversation(conversation)
      setConversations((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id)
        return [...withoutCurrent, conversation]
      })
      setActionMessage('Чат закреплён за вами.')
    } catch (err) {
      setActionError(getErrorMessage(err, 'Не удалось взять чат в работу.'))
    } finally {
      setTakingConversation(false)
    }
  }

  async function handleReleaseConversation() {
    if (!selectedConversationId) return

    setReleasingConversation(true)
    setActionError('')
    setActionMessage('')

    try {
      const conversation = await releaseSupportConversation(selectedConversationId)
      setSelectedConversation(conversation)
      setConversations((previous) => {
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id)
        return [...withoutCurrent, conversation]
      })
      setActionMessage('Чат снова помещён в общую очередь.')
    } catch (err) {
      setActionError(getErrorMessage(err, 'Не удалось снять чат с себя.'))
    } finally {
      setReleasingConversation(false)
    }
  }

  const selectedConversationClosed = selectedConversation?.status === 'closed'
  const selectedQueueType = isAdmin && selectedConversation ? getAdminQueueType(selectedConversation, user?.id) : null
  const selectedConversationMine = isAdmin && selectedQueueType === 'mine'
  const selectedConversationFree = isAdmin && selectedQueueType === 'free'
  const selectedConversationBusy = isAdmin && selectedQueueType === 'busy'

  function renderQueueCaption(conversation) {
    if (isAdmin) {
      return `${conversation.user.full_name} · ${conversation.user.email}`
    }

    if (conversation.assigned_admin) {
      return `Чат ведёт: ${conversation.assigned_admin.full_name}`
    }

    return `Создан: ${formatDateTime(conversation.created_at)}`
  }

  return (
    <div className="workspace-page support-page">
      <section className="page-header">
        <div>
          <h1>{isAdmin ? 'Чаты поддержки' : 'Техническая поддержка'}</h1>
          <p className="muted">
            {isAdmin
              ? 'Сначала возьмите чат в работу, затем отвечайте пользователю и закрывайте обращение после завершения.'
              : 'Задавайте вопросы администратору. После закрытия чата можно открыть новый.'}
          </p>
        </div>
        <div className="header-actions">
          {!isAdmin ? (
            <button type="button" className="button-secondary" onClick={handleCreateConversation} disabled={creatingConversation || hasOpenConversation}>
              {creatingConversation ? 'Создание...' : 'Новый чат'}
            </button>
          ) : null}
          <button type="button" className="button-secondary" onClick={onBack}>Назад</button>
        </div>
      </section>

      <FormGuide title={isAdmin ? 'Справка по чатам поддержки' : 'Справка по технической поддержке'} items={buildSupportGuideItems(isAdmin)} />

      {!isAdmin && hasOpenConversation ? (
        <div className="muted small">
          Сейчас у вас уже есть открытый чат. Новый чат станет доступен после его закрытия администратором.
        </div>
      ) : null}

      {listError ? <div className="error">{listError}</div> : null}
      {actionError ? <div className="error">{actionError}</div> : null}
      {actionMessage ? <div className="success">{actionMessage}</div> : null}

      {isAdmin ? (
        <section className="stats-grid support-stats-grid">
          <article className="card stat-card support-stat-card"><div className="muted">Свободные</div><div className="stat-value">{adminCounters.free}</div></article>
          <article className="card stat-card support-stat-card"><div className="muted">Мои</div><div className="stat-value">{adminCounters.mine}</div></article>
          <article className="card stat-card support-stat-card"><div className="muted">Занятые</div><div className="stat-value">{adminCounters.busy}</div></article>
          <article className="card stat-card support-stat-card"><div className="muted">Закрытые</div><div className="stat-value">{adminCounters.closed}</div></article>
        </section>
      ) : null}

      <section className="support-layout support-layout--balanced">
        <aside className="card support-list-card">
          <div className="section-head">
            <div>
              <h2>{isAdmin ? 'Очередь обращений' : 'Мои чаты'}</h2>
              <p className="muted">{loadingList ? 'Загрузка...' : `Всего чатов: ${conversations.length}`}</p>
            </div>
          </div>

          {isAdmin ? (
            <div className="tabs support-filter-tabs">
              <button type="button" className={adminFilter === 'all' ? 'active' : ''} onClick={() => setAdminFilter('all')}>Все</button>
              <button type="button" className={adminFilter === 'free' ? 'active' : ''} onClick={() => setAdminFilter('free')}>Свободные</button>
              <button type="button" className={adminFilter === 'mine' ? 'active' : ''} onClick={() => setAdminFilter('mine')}>Мои</button>
              <button type="button" className={adminFilter === 'busy' ? 'active' : ''} onClick={() => setAdminFilter('busy')}>Занятые</button>
              <button type="button" className={adminFilter === 'closed' ? 'active' : ''} onClick={() => setAdminFilter('closed')}>Закрытые</button>
            </div>
          ) : null}

          {filteredConversations.length === 0 ? (
            <div className="empty-state">
              <h3>{isAdmin ? 'Подходящих обращений пока нет' : 'Чатов пока нет'}</h3>
              <p className="muted">
                {isAdmin
                  ? 'Измените фильтр или дождитесь нового обращения пользователя.'
                  : 'Создайте новый чат, чтобы написать администратору.'}
              </p>
            </div>
          ) : (
            <div className="support-list">
              {filteredConversations.map((conversation) => {
                const unreadCount = getUnreadCount(conversation, isAdmin)
                const isSelected = selectedConversationId === conversation.id
                const queueType = isAdmin ? getAdminQueueType(conversation, user?.id) : null
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`support-list-item ${isSelected ? 'support-list-item--selected' : ''}`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <div className="support-list-item__head">
                      <strong>{getChatTitle(conversation)}</strong>
                      <div className="support-list-item__chips">
                        {isAdmin ? (
                          <span className={`status-chip support-queue-chip support-queue-chip--${queueType}`}>
                            {getQueueLabel(queueType)}
                          </span>
                        ) : null}
                        <span className={`status-chip ${conversation.status === 'closed' ? 'warning' : 'success'}`}>
                          {getChatStatusLabel(conversation.status)}
                        </span>
                      </div>
                    </div>
                    <div className="muted small">{renderQueueCaption(conversation)}</div>
                    <div className="support-list-item__preview">{conversation.last_message_preview || 'Сообщений пока нет.'}</div>
                    <div className="support-list-item__meta muted small">
                      <span>Последняя активность: {formatDateTime(conversation.last_message_at || conversation.created_at)}</span>
                      {unreadCount > 0 ? <span className="support-unread-badge">Новых: {unreadCount}</span> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <section className="card support-chat-card">
          {!selectedConversationId ? (
            <div className="empty-state">
              <h3>Чат не выбран</h3>
              <p className="muted">Выберите чат слева, чтобы прочитать сообщения и продолжить работу.</p>
            </div>
          ) : loadingConversation && !selectedConversation ? (
            <div className="empty-state">
              <h3>Загрузка чата</h3>
              <p className="muted">Подождите, сообщения загружаются.</p>
            </div>
          ) : conversationError ? (
            <div className="error">{conversationError}</div>
          ) : selectedConversation ? (
            <>
              <div className="section-head support-chat-card__head">
                <div>
                  <h2>{getChatTitle(selectedConversation)}</h2>
                  <p className="muted">
                    {isAdmin
                      ? `${selectedConversation.user.full_name} · ${selectedConversation.user.email}`
                      : `Статус: ${getChatStatusLabel(selectedConversation.status)}`}
                  </p>
                  {isAdmin ? (
                    <div className="support-assignment-box muted small">
                      {selectedConversationClosed ? (
                        <span>Чат закрыт{selectedConversation.assigned_admin ? ` администратором ${selectedConversation.assigned_admin.full_name}` : ''}.</span>
                      ) : selectedConversationMine ? (
                        <span>Этот чат закреплён за вами с {formatDateTime(selectedConversation.assigned_at)}.</span>
                      ) : selectedConversationFree ? (
                        <span>Чат свободен. Возьмите его в работу перед ответом пользователю.</span>
                      ) : selectedConversationBusy ? (
                        <span>Чат ведёт администратор {selectedConversation.assigned_admin?.full_name}. Отвечать может только он.</span>
                      ) : null}
                    </div>
                  ) : selectedConversation.assigned_admin ? (
                    <div className="support-assignment-box muted small">
                      Чат ведёт администратор {selectedConversation.assigned_admin.full_name}.
                    </div>
                  ) : (
                    <div className="support-assignment-box muted small">
                      Чат ещё не взят в работу. Ожидайте ответа свободного администратора.
                    </div>
                  )}
                </div>

                {isAdmin ? (
                  <div className="support-admin-actions">
                    {selectedConversationFree ? (
                      <button type="button" onClick={handleTakeConversation} disabled={takingConversation}>
                        {takingConversation ? 'Закрепление...' : 'Взять чат'}
                      </button>
                    ) : null}
                    {selectedConversationMine && !selectedConversationClosed ? (
                      <button type="button" className="button-secondary" onClick={handleReleaseConversation} disabled={releasingConversation}>
                        {releasingConversation ? 'Снятие...' : 'Снять с себя'}
                      </button>
                    ) : null}
                    {selectedConversationMine && !selectedConversationClosed ? (
                      <button type="button" className="button-secondary" onClick={handleCloseConversation} disabled={closingConversation}>
                        {closingConversation ? 'Закрытие...' : 'Закрыть чат'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="support-messages">
                {selectedConversation.messages.length === 0 ? (
                  <div className="empty-box muted">В этом чате пока нет сообщений.</div>
                ) : (
                  selectedConversation.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`support-message ${message.is_from_admin ? 'support-message--admin' : 'support-message--user'}`}
                    >
                      <div className="support-message__meta">
                        <strong>{message.author_name}</strong>
                        <span>{formatDateTime(message.created_at)}</span>
                      </div>
                      <div className="support-message__body">{message.text}</div>
                    </article>
                  ))
                )}
              </div>

              <form className="support-form" onSubmit={handleSendMessage}>
                {selectedConversationClosed ? (
                  <div className="empty-box muted">
                    Этот чат закрыт. Продолжить переписку в нём нельзя.
                    {!isAdmin ? ' Создайте новый чат для нового обращения.' : ''}
                  </div>
                ) : null}
                {isAdmin && selectedConversationFree ? (
                  <div className="empty-box muted">Чтобы ответить пользователю, сначала нажмите «Взять чат».</div>
                ) : null}
                {isAdmin && selectedConversationBusy ? (
                  <div className="empty-box muted">Этот чат уже ведёт другой администратор. Чтобы не создавать путаницу, отвечать в него нельзя.</div>
                ) : null}

                <label>
                  Сообщение
                  <textarea
                    rows={5}
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder={selectedConversationClosed ? 'Чат закрыт' : 'Введите сообщение'}
                    disabled={selectedConversationClosed || sendingMessage || (isAdmin && !selectedConversationMine)}
                  />
                </label>
                <div className="support-form__actions">
                  <button type="submit" disabled={selectedConversationClosed || sendingMessage || (isAdmin && !selectedConversationMine)}>
                    {sendingMessage ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </section>
      </section>
    </div>
  )
}
