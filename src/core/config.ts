const value = import.meta.env.VITE_API_BASE_URL as string | undefined

if (!value || value.trim() === '') {
  throw new Error(
    'VITE_API_BASE_URL is not set. Define it in .env.local (see .env.example).',
  )
}

export const API_BASE_URL: string = value
