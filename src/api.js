const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function cookie(name) {
  const prefix = `${name}=`
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix))
  return value ? decodeURIComponent(value.slice(prefix.length)) : null
}

async function csrfToken() {
  await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' })
  return cookie('ECOMMERCE-XSRF-TOKEN')
}

export async function api(path, options = {}) {
  const method = options.method || 'GET'
  const headers = { ...(options.headers || {}) }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await csrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    const fieldMessage = data?.fieldErrors && Object.values(data.fieldErrors)[0]
    throw new Error(fieldMessage || data?.message || `İşlem başarısız (${response.status})`)
  }
  return data
}
