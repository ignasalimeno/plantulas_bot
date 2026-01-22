import axios from 'axios'

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to include telegram user id from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const telegramUserId = localStorage.getItem('telegramUserId') || '12345678'
    config.headers['X-Telegram-UserId'] = telegramUserId
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)
