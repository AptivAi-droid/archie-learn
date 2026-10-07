// Archie Learn REST API client — the only way the web app talks to the backend.
// Contract: docs/API.md. Native fetch only (no Axios), 15 s timeout per request.

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '')
export const API_BASE = `${API_ROOT}/api/v1`
export const REQUEST_TIMEOUT_MS = 15000

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error('[Archie] VITE_API_URL was NOT set at build time — falling back to http://localhost:8080.')
}

// Prod and dev builds share the github.io origin — keep their tokens separate
const TOKEN_KEY = import.meta.env.BASE_URL.includes('/dev/') ? 'archie-learn-dev-token' : 'archie-learn-token'

export const UNREACHABLE_MESSAGE =
  "Can't reach the Archie server. Check your internet connection and try again."

// ─── Token storage (storage can throw in private mode / blocked site data) ──────
let memoryToken = null

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || memoryToken
  } catch {
    return memoryToken
  }
}

export function setToken(token) {
  memoryToken = token || null
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Keep the in-memory copy — the session just won't survive a reload
  }
}

export function clearToken() {
  setToken(null)
}

// ─── 401 notification (AuthContext subscribes) ─────────────────────────────────
const unauthorizedListeners = new Set()

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

// ─── Errors ───────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code // server `code` (e.g. "ADULT"), or NETWORK / TIMEOUT for transport failures
    this.fields = fields // server `errors` (per-field validation messages)
    this.data = data // full parsed error body, for anything else the server includes
  }
}

const NETWORK_ERROR_PATTERNS = ['failed to fetch', 'networkerror', 'timed out', 'err_name_not_resolved', 'load failed']

// Maps network/timeout failures to one learner-friendly message; otherwise the server's text.
export function friendlyError(err) {
  if (err instanceof ApiError && (err.code === 'NETWORK' || err.code === 'TIMEOUT')) {
    return UNREACHABLE_MESSAGE
  }
  const raw = typeof err === 'string' ? err : err?.message || ''
  if (NETWORK_ERROR_PATTERNS.some((p) => raw.toLowerCase().includes(p))) return UNREACHABLE_MESSAGE
  return raw || 'Something went wrong. Please try again.'
}

function fallbackMessage(status) {
  if (status === 401) return 'Please log in again.'
  if (status === 403) return "You don't have access to that."
  if (status === 404) return "We couldn't find that."
  if (status === 429) return 'Too many requests. Please wait a bit and try again.'
  if (status >= 500) return 'Archie had a problem on our side. Please try again.'
  return 'Something went wrong. Please try again.'
}

// ─── Core request ─────────────────────────────────────────────────────────────
export async function request(method, path, { body, auth = true, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const headers = { Accept: 'application/json' }
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    const timedOut = err?.name === 'AbortError'
    throw new ApiError(UNREACHABLE_MESSAGE, { code: timedOut ? 'TIMEOUT' : 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }

  let data = null
  const text = await response.text().catch(() => '')
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken()
      unauthorizedListeners.forEach((fn) => {
        try { fn() } catch { /* listener errors must not mask the API error */ }
      })
    }
    throw new ApiError(data?.error || fallbackMessage(response.status), {
      status: response.status,
      code: data?.code || null,
      fields: data?.errors || null,
      data,
    })
  }
  return data
}

const get = (path, opts) => request('GET', path, opts)
const post = (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} })
const put = (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} })
const del = (path, opts) => request('DELETE', path, opts)
const id = (v) => encodeURIComponent(v)

function query(params) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ─── Endpoint groups ──────────────────────────────────────────────────────────
export const health = () => get('/health', { auth: false })

export const auth = {
  register: ({ email, password, dob }) => post('/auth/register', { email, password, dob }, { auth: false }),
  login: ({ email, password }) => post('/auth/login', { email, password }, { auth: false }),
  logout: () => post('/auth/logout'),
  forgotPassword: (email) => post('/auth/password/forgot', { email }, { auth: false }),
  resetPassword: ({ token, password }) => post('/auth/password/reset', { token, password }, { auth: false }),
}

export const me = {
  get: () => get('/me'),
  updateProfile: (fields) => put('/me/profile', fields),
  changePassword: ({ current_password, new_password }) => put('/me/password', { current_password, new_password }),
  classes: () => get('/me/classes'),
  leaveClass: (classId) => del(`/me/classes/${id(classId)}`),
}

export const applications = {
  submit: ({ email, password, role, dob, application_data }) =>
    post('/applications', { email, password, role, dob, application_data }, { auth: false }),
}

export const chat = {
  send: ({ session_id = null, subject, content }) => post('/chat/messages', { session_id, subject, content }),
  messages: (sessionId) => get(`/chat/sessions/${id(sessionId)}/messages`),
}

export const practice = {
  questions: ({ subject, grade, limit = 5 }) => get(`/practice/questions${query({ subject, grade, limit })}`),
  answer: ({ question_id, answer }) => post('/practice/answers', { question_id, answer }),
}

export const lessons = {
  view: ({ subject, grade, topic_key }) => post('/lessons/views', { subject, grade, topic_key }),
}

export const progress = {
  get: () => get('/progress'),
}

export const buddy = {
  get: () => get('/buddy'),
  save: (buddy_data) => put('/buddy', { buddy_data }),
}

export const linkCodes = {
  create: () => post('/link-codes'),
}

export const parent = {
  students: () => get('/parent/students'),
  activity: (studentId) => get(`/parent/students/${id(studentId)}/activity`),
  link: (code) => post('/parent/links', { code }),
}

export const teacher = {
  classes: () => get('/teacher/classes'),
  createClass: ({ name, subject = null, grade = null }) => post('/teacher/classes', { name, subject, grade }),
  deleteClass: (classId) => del(`/teacher/classes/${id(classId)}`),
  classActivity: (classId) => get(`/teacher/classes/${id(classId)}/activity`),
  removeStudent: (classId, studentId) => del(`/teacher/classes/${id(classId)}/students/${id(studentId)}`),
}

export const classes = {
  join: (code) => post('/classes/join', { code }),
}

export const feedback = {
  send: ({ session_id = null, rating, what_worked = null, what_frustrated = null }) =>
    post('/feedback', { session_id, rating, what_worked, what_frustrated }),
}

export const admin = {
  overview: () => get('/admin/overview'),
  sessionMessages: (sessionId) => get(`/admin/sessions/${id(sessionId)}/messages`),
  reviewApplication: (applicationId, { status, notes = null }) =>
    put(`/admin/applications/${id(applicationId)}`, { status, notes }),
}
