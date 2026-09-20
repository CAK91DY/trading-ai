export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch('/api' + path, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'TradingAI',
        ...options.headers,
      },
    })
    if (response.status === 204) return undefined as T
    const data = await response.json()
    if (!response.ok) {
      const detail = data.detail
      throw new ApiError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg: string }) => d.msg).join(' · ')
            : 'Une erreur est survenue.',
        response.status,
      )
    }
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new Error('Connexion impossible ou délai dépassé. Réessayez.')
  } finally {
    clearTimeout(timer)
  }
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) })
