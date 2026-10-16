// In-memory + sessionStorage client cache for instant student navigation (SWR)

const memoryCache: Record<string, any> = {}

export function getCachedStudentData<T>(key: string): T | null {
  if (memoryCache[key]) {
    return memoryCache[key] as T
  }
  if (typeof window !== 'undefined') {
    try {
      const val = sessionStorage.getItem(`jav_cache_${key}`)
      if (val) {
        const parsed = JSON.parse(val)
        memoryCache[key] = parsed
        return parsed as T
      }
    } catch {
      // ignore
    }
  }
  return null
}

export function setCachedStudentData<T>(key: string, data: T): void {
  memoryCache[key] = data
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`jav_cache_${key}`, JSON.stringify(data))
    } catch {
      // ignore
    }
  }
}

export function clearStudentCache(): void {
  Object.keys(memoryCache).forEach(k => delete memoryCache[k])
  if (typeof window !== 'undefined') {
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('jav_cache_')) {
          sessionStorage.removeItem(k)
        }
      })
    } catch {
      // ignore
    }
  }
}
