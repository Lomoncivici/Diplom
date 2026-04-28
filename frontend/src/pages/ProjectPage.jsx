import { useEffect, useMemo, useState } from 'react'
import {
  createProject,
  createProjectComponent,
  deleteProject,
  deleteProjectComponent,
  getProject,
  getProjectComponents,
  getProjectTests,
  updateProject,
  updateProjectComponent,
} from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import TestList from '../components/TestList'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const systemTypeOptions = [
  { value: 'api', label: 'API и веб-служба' },
  { value: 'website', label: 'Веб-сайт' },
  { value: 'web_application', label: 'Веб-приложение' },
  { value: 'microservice_system', label: 'Микросервисная система' },
  { value: 'mobile_backend', label: 'Сервер мобильного приложения' },
  { value: 'other', label: 'Другая система' },
]

const componentTypeOptions = [
  { value: 'internal_component', label: 'Внутренний компонент системы' },
  { value: 'external_integration', label: 'Внешняя интеграция' },
]

const criticalityOptions = [
  { value: 'critical', label: 'Критичная' },
  { value: 'important', label: 'Важная' },
  { value: 'optional', label: 'Дополнительная' },
]

const emptyDraft = {
  name: '',
  description: '',
  system_type: 'api',
  base_url: '',
  environment_name: '',
  system_owner: '',
}

const emptyComponentDraft = {
  name: '',
  component_type: 'internal_component',
  description: '',
  endpoint_url: '',
  responsible_name: '',
  criticality_level: 'important',
}

const projectGuideItems = [
  {
    label: 'Карточка внешней системы',
    text: 'Храни здесь основные сведения о внешнем сайте, приложении, API или распределённой системе, которую платформа будет нагружать и анализировать.',
  },
  {
    label: 'Среда и ответственный',
    text: 'Заполняй среду тестирования и ответственного со стороны проверяемой системы. Это помогает понимать, на каком стенде проводились испытания и к кому обращаться по результатам.',
  },
  {
    label: 'Базовый адрес',
    text: 'Сохраняй главный адрес внешней системы или её входной точки. Он используется как ориентир при настройке тестов и описании архитектуры.',
  },
]

const componentGuideItems = [
  {
    label: 'Внутренние компоненты',
    text: 'Добавляй собственные части тестируемой системы: сервис авторизации, каталог, корзину, шлюз, сервис отчётов и другие элементы, которые находятся внутри целевого решения.',
  },
  {
    label: 'Внешние интеграции',
    text: 'Отмечай сторонние зависимости: платёжные шлюзы, карты, доставку, почту, внешние API и другие сервисы, влияние которых нужно учитывать при анализе нагрузки.',
  },
  {
    label: 'Ответственный и критичность',
    text: 'Укажи владельца компонента и степень критичности. Это пригодится на следующих этапах, когда появятся разрезы аналитики и контроль деградации по узлам системы.',
  },
]

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

function buildDraftFromProject(data) {
  return {
    name: data?.name || '',
    description: data?.description || '',
    system_type: data?.system_type || 'api',
    base_url: data?.base_url || '',
    environment_name: data?.environment_name || '',
    system_owner: data?.system_owner || '',
  }
}

function buildDraftFromComponent(component) {
  return {
    name: component?.name || '',
    component_type: component?.component_type || 'internal_component',
    description: component?.description || '',
    endpoint_url: component?.endpoint_url || '',
    responsible_name: component?.responsible_name || '',
    criticality_level: component?.criticality_level || 'important',
  }
}

function getSystemTypeLabel(value) {
  return systemTypeOptions.find((option) => option.value === value)?.label || 'Тестируемая система'
}

function getComponentTypeLabel(value) {
  return componentTypeOptions.find((option) => option.value === value)?.label || 'Компонент системы'
}

function getCriticalityLabel(value) {
  return criticalityOptions.find((option) => option.value === value)?.label || 'Важная'
}

function getComponentBadgeClass(value) {
  return value === 'external_integration' ? 'component-badge component-badge--integration' : 'component-badge'
}

export default function ProjectPage({
  mode = 'edit',
  projectId,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
  onOpenTest,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [project, setProject] = useState(null)
  const [tests, setTests] = useState([])
  const [components, setComponents] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [draft, setDraft] = useState(emptyDraft)

  const [componentDraft, setComponentDraft] = useState(emptyComponentDraft)
  const [componentFieldErrors, setComponentFieldErrors] = useState({})
  const [componentError, setComponentError] = useState('')
  const [componentMessage, setComponentMessage] = useState('')
  const [componentSaving, setComponentSaving] = useState(false)
  const [editingComponentId, setEditingComponentId] = useState(null)

  async function loadProject() {
    if (!projectId) return
    const data = await getProject(projectId)
    setProject(data)
    setDraft(buildDraftFromProject(data))
  }

  async function loadTests() {
    if (!projectId) return
    const list = await getProjectTests(projectId)
    setTests(list)
  }

  async function loadComponents() {
    if (!projectId) return
    const list = await getProjectComponents(projectId)
    setComponents(list)
  }

  async function reloadProjectStructure() {
    if (!projectId) return
    const [projectData, componentsData] = await Promise.all([getProject(projectId), getProjectComponents(projectId)])
    setProject(projectData)
    setDraft(buildDraftFromProject(projectData))
    setComponents(componentsData)
    onProjectUpdated?.()
  }

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      if (mode !== 'edit' || !projectId) return

      setError('')
      try {
        const [projectData, testsData, componentsData] = await Promise.all([
          getProject(projectId),
          getProjectTests(projectId),
          getProjectComponents(projectId),
        ])
        if (cancelled) return
        setProject(projectData)
        setDraft(buildDraftFromProject(projectData))
        setTests(testsData)
        setComponents(componentsData)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Не удалось загрузить карточку системы, компоненты и тесты.'))
          setTests([])
          setComponents([])
        }
      }
    }

    loadPage()
    return () => {
      cancelled = true
    }
  }, [mode, projectId])

  const componentStats = useMemo(() => {
    const internalCount = components.filter((item) => item.component_type === 'internal_component').length
    const externalCount = components.filter((item) => item.component_type === 'external_integration').length
    return {
      total: components.length,
      internalCount,
      externalCount,
    }
  }, [components])

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function patchComponent(field, value) {
    setComponentDraft((prev) => ({ ...prev, [field]: value }))
    setComponentFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function resetComponentEditor() {
    setEditingComponentId(null)
    setComponentDraft(emptyComponentDraft)
    setComponentFieldErrors({})
    setComponentError('')
  }

  function startEditComponent(component) {
    setEditingComponentId(component.id)
    setComponentDraft(buildDraftFromComponent(component))
    setComponentFieldErrors({})
    setComponentError('')
    setComponentMessage('')
  }

  async function handleSaveProject() {
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      if (mode === 'create') {
        const created = await createProject(draft)
        onProjectCreated?.(created.id)
      } else {
        await updateProject(projectId, draft)
        await loadProject()
        onProjectUpdated?.()
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setFieldErrors(getFieldErrors(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProject() {
    const confirmed = window.confirm(
      'Удалить карточку системы? Все тесты, запуски, компоненты и связанные данные будут удалены.',
    )
    if (!confirmed) return

    try {
      await deleteProject(projectId)
      await onProjectDeleted?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить карточку системы.'))
    }
  }

  async function handleSaveComponent() {
    if (!projectId) return

    setComponentSaving(true)
    setComponentError('')
    setComponentMessage('')
    setComponentFieldErrors({})

    try {
      if (editingComponentId) {
        await updateProjectComponent(projectId, editingComponentId, componentDraft)
        setComponentMessage('Карточка компонента обновлена.')
      } else {
        await createProjectComponent(projectId, componentDraft)
        setComponentMessage('Компонент добавлен в структуру системы.')
      }
      await reloadProjectStructure()
      resetComponentEditor()
    } catch (err) {
      setComponentError(getErrorMessage(err, 'Не удалось сохранить компонент системы.'))
      setComponentFieldErrors(getFieldErrors(err))
    } finally {
      setComponentSaving(false)
    }
  }

  async function handleDeleteComponent(component) {
    if (!projectId) return
    const confirmed = window.confirm(`Удалить элемент «${component.name}» из структуры системы?`)
    if (!confirmed) return

    try {
      await deleteProjectComponent(projectId, component.id)
      if (editingComponentId === component.id) {
        resetComponentEditor()
      }
      setComponentMessage('Элемент структуры системы удалён.')
      await reloadProjectStructure()
    } catch (err) {
      setComponentError(getErrorMessage(err, 'Не удалось удалить компонент системы.'))
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{mode === 'create' ? 'Новая тестируемая система' : project?.name || 'Тестируемая система'}</h1>
          <p className="muted">
            {mode === 'create'
              ? 'Создайте карточку внешней системы, сайта или приложения, которое будет проходить нагрузочное тестирование.'
              : project?.description || 'Описание системы пока не заполнено.'}
          </p>
          {mode === 'edit' && project ? (
            <div className="muted small project-page-summary">
              <span>Тип: {getSystemTypeLabel(project.system_type)}</span>
              {project.environment_name ? <span>Среда: {project.environment_name}</span> : null}
              {project.base_url ? <span>Адрес: {project.base_url}</span> : null}
              <span>Компонентов: {project.components_count ?? componentStats.total}</span>
              <span>Интеграций: {project.external_integrations_count ?? componentStats.externalCount}</span>
            </div>
          ) : null}
        </div>

        <div className="header-actions">
          <button type="button" className="button-secondary" onClick={onBack}>
            Назад к системам
          </button>
          <button onClick={handleSaveProject} disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать систему' : 'Сохранить карточку'}
          </button>
          {mode === 'edit' ? (
            <button className="button-danger" type="button" onClick={handleDeleteProject}>
              Удалить систему
            </button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Карточка системы
        </button>
        {mode === 'edit' ? (
          <button
            type="button"
            className={activeTab === 'structure' ? 'active' : ''}
            onClick={() => setActiveTab('structure')}
          >
            Структура системы
          </button>
        ) : null}
        {mode === 'edit' ? (
          <button
            type="button"
            className={activeTab === 'tests' ? 'active' : ''}
            onClick={() => setActiveTab('tests')}
          >
            Тесты
          </button>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      {activeTab === 'overview' && (
        <section className="card form-card">
          <FormGuide title="Справка по карточке системы" items={projectGuideItems} />
          <div className="form-grid form-grid--double">
            <label>
              Название системы
              <input
                className={getInputClassName(fieldErrors, 'name')}
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="Например, Интернет-магазин Альфа"
              />
              <FieldHint>Используй название внешнего продукта, сервиса или домена, который тестируется.</FieldHint>
              {renderFieldError(fieldErrors, 'name')}
            </label>
            <label>
              Тип системы
              <select
                className={getInputClassName(fieldErrors, 'system_type')}
                value={draft.system_type}
                onChange={(e) => patch('system_type', e.target.value)}
              >
                {systemTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FieldHint>Помогает отделять API, сайты, веб-приложения и микросервисные решения.</FieldHint>
              {renderFieldError(fieldErrors, 'system_type')}
            </label>
            <label>
              Базовый адрес системы
              <input
                className={getInputClassName(fieldErrors, 'base_url')}
                value={draft.base_url}
                onChange={(e) => patch('base_url', e.target.value)}
                placeholder="Например, https://stage.example.ru"
              />
              <FieldHint>Главный адрес внешней системы или её основной точки входа.</FieldHint>
              {renderFieldError(fieldErrors, 'base_url')}
            </label>
            <label>
              Среда тестирования
              <input
                className={getInputClassName(fieldErrors, 'environment_name')}
                value={draft.environment_name}
                onChange={(e) => patch('environment_name', e.target.value)}
                placeholder="Например, Тестовый стенд 2"
              />
              <FieldHint>Укажи контур, стенд или окружение, где проходят испытания.</FieldHint>
              {renderFieldError(fieldErrors, 'environment_name')}
            </label>
            <label className="field-span-2">
              Ответственный за систему
              <input
                className={getInputClassName(fieldErrors, 'system_owner')}
                value={draft.system_owner}
                onChange={(e) => patch('system_owner', e.target.value)}
                placeholder="Например, Команда заказов или Иван Петров"
              />
              <FieldHint>Это не владелец аккаунта в платформе, а ответственный со стороны тестируемой системы.</FieldHint>
              {renderFieldError(fieldErrors, 'system_owner')}
            </label>
            <label className="field-span-2">
              Описание системы
              <textarea
                className={getInputClassName(fieldErrors, 'description')}
                value={draft.description}
                onChange={(e) => patch('description', e.target.value)}
                placeholder="Кратко опишите назначение системы, основные функции и цель нагрузочного тестирования"
                rows={6}
              />
              <FieldHint>Например: веб-приложение интернет-магазина с внешними интеграциями доставки, оплаты и карт.</FieldHint>
              {renderFieldError(fieldErrors, 'description')}
            </label>
          </div>
        </section>
      )}

      {activeTab === 'structure' && mode === 'edit' && projectId ? (
        <section className="workspace-stack">
          <FormGuide title="Справка по структуре системы" items={componentGuideItems} />

          <div className="stats-grid stats-grid--three">
            <article className="card stat-card">
              <div className="muted">Всего элементов</div>
              <div className="stat-value">{componentStats.total}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Внутренние компоненты</div>
              <div className="stat-value">{componentStats.internalCount}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Внешние интеграции</div>
              <div className="stat-value">{componentStats.externalCount}</div>
            </article>
          </div>

          {componentError ? <div className="error">{componentError}</div> : null}
          {componentMessage ? <div className="success">{componentMessage}</div> : null}

          <div className="component-layout">
            <section className="card component-catalog">
              <div className="section-head">
                <div>
                  <h2>Компоненты и интеграции</h2>
                  <p className="muted">Опишите архитектуру целевой системы: внутренние узлы и сторонние зависимости.</p>
                </div>
                <button type="button" className="button-secondary" onClick={resetComponentEditor}>
                  Новый элемент
                </button>
              </div>

              {components.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>Структура пока не заполнена</h3>
                  <p className="muted">Добавьте первый внутренний компонент или внешнюю интеграцию тестируемой системы.</p>
                </div>
              ) : (
                <div className="component-list">
                  {components.map((component) => {
                    const isEditing = editingComponentId === component.id
                    return (
                      <article key={component.id} className={`component-card ${isEditing ? 'component-card--active' : ''}`}>
                        <div className="project-nav-head">
                          <div>
                            <h3>{component.name}</h3>
                            <div className="component-card__badges">
                              <span className={getComponentBadgeClass(component.component_type)}>
                                {getComponentTypeLabel(component.component_type)}
                              </span>
                              <span className="project-type-badge">{getCriticalityLabel(component.criticality_level)}</span>
                            </div>
                          </div>
                        </div>
                        <p>{component.description || 'Описание элемента структуры пока не заполнено.'}</p>
                        <div className="project-nav-meta component-card__meta">
                          {component.endpoint_url ? <span>Адрес: {component.endpoint_url}</span> : <span>Адрес не указан</span>}
                          {component.responsible_name ? <span>Ответственный: {component.responsible_name}</span> : null}
                        </div>
                        <div className="component-card__actions">
                          <button type="button" className="button-secondary" onClick={() => startEditComponent(component)}>
                            Редактировать
                          </button>
                          <button type="button" className="button-danger" onClick={() => handleDeleteComponent(component)}>
                            Удалить
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="card component-editor">
              <div className="section-head">
                <div>
                  <h2>{editingComponentId ? 'Редактирование элемента структуры' : 'Новый элемент структуры'}</h2>
                  <p className="muted">Добавляйте внутренние части системы и внешние зависимости, которые влияют на поведение под нагрузкой.</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Название элемента
                  <input
                    className={getInputClassName(componentFieldErrors, 'name')}
                    value={componentDraft.name}
                    onChange={(e) => patchComponent('name', e.target.value)}
                    placeholder="Например, Сервис авторизации или Яндекс Карты"
                  />
                  <FieldHint>Укажите реальное название узла, чтобы потом было легко связать его с тестами и аналитикой.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'name')}
                </label>
                <label>
                  Тип элемента
                  <select
                    className={getInputClassName(componentFieldErrors, 'component_type')}
                    value={componentDraft.component_type}
                    onChange={(e) => patchComponent('component_type', e.target.value)}
                  >
                    {componentTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <FieldHint>Внутренний компонент относится к самой тестируемой системе, а внешняя интеграция — к сторонней зависимости.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'component_type')}
                </label>
                <label>
                  Адрес или точка подключения
                  <input
                    className={getInputClassName(componentFieldErrors, 'endpoint_url')}
                    value={componentDraft.endpoint_url}
                    onChange={(e) => patchComponent('endpoint_url', e.target.value)}
                    placeholder="Например, https://api.example.ru/orders"
                  />
                  <FieldHint>Можно указать адрес сервиса, шлюза, внешнего API или корневой URL интеграции.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'endpoint_url')}
                </label>
                <label>
                  Критичность
                  <select
                    className={getInputClassName(componentFieldErrors, 'criticality_level')}
                    value={componentDraft.criticality_level}
                    onChange={(e) => patchComponent('criticality_level', e.target.value)}
                  >
                    {criticalityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <FieldHint>Позже это поможет расставлять приоритеты при анализе деградации.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'criticality_level')}
                </label>
                <label className="field-span-2">
                  Ответственный за элемент
                  <input
                    className={getInputClassName(componentFieldErrors, 'responsible_name')}
                    value={componentDraft.responsible_name}
                    onChange={(e) => patchComponent('responsible_name', e.target.value)}
                    placeholder="Например, Команда каталога или Контур доставки"
                  />
                  <FieldHint>Можно указать владельца компонента, интеграции или контактную группу.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'responsible_name')}
                </label>
                <label className="field-span-2">
                  Описание роли элемента
                  <textarea
                    className={getInputClassName(componentFieldErrors, 'description')}
                    value={componentDraft.description}
                    onChange={(e) => patchComponent('description', e.target.value)}
                    rows={6}
                    placeholder="Опишите, за что отвечает компонент или зачем нужна внешняя интеграция"
                  />
                  <FieldHint>Например: принимает авторизацию пользователей, хранит каталог, рассчитывает доставку, вызывает внешний платёжный сервис.</FieldHint>
                  {renderFieldError(componentFieldErrors, 'description')}
                </label>
              </div>

              <div className="component-editor__actions">
                <button type="button" onClick={handleSaveComponent} disabled={componentSaving}>
                  {componentSaving ? 'Сохранение...' : editingComponentId ? 'Сохранить элемент' : 'Добавить элемент'}
                </button>
                <button type="button" className="button-secondary" onClick={resetComponentEditor} disabled={componentSaving}>
                  Очистить форму
                </button>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {activeTab === 'tests' && mode === 'edit' && projectId ? (
        <section className="card">
          <TestList
            projectId={projectId}
            tests={tests}
            onOpenTest={onOpenTest}
            onReload={loadTests}
          />
        </section>
      ) : null}
    </section>
  )
}
