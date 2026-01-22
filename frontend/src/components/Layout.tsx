import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [telegramUserId, setTelegramUserId] = useState<string>('12345678')

  // Load telegram user id from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('telegram_user_id')
    if (stored) {
      setTelegramUserId(stored)
    } else {
      // Initialize with default value
      localStorage.setItem('telegram_user_id', '12345678')
    }
  }, [])

  // Save to localStorage when changed
  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTelegramUserId(value)
    localStorage.setItem('telegram_user_id', value)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">PlantulasBot</h1>
        </div>

        {/* Telegram User ID Input */}
        <div className="px-6 pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Usuario de Telegram ID
          </label>
          <input
            type="text"
            value={telegramUserId}
            onChange={handleUserIdChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="12345678"
          />
        </div>

        {/* Navigation */}
        <nav className="px-4">
          <Link
            to="/panel"
            className={`block px-4 py-3 mb-2 rounded-lg transition-colors ${
              isActive('/panel')
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Panel
          </Link>
          <Link
            to="/indoors"
            className={`block px-4 py-3 mb-2 rounded-lg transition-colors ${
              isActive('/indoors')
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Indoors
          </Link>
          <Link
            to="/chatbot-test"
            className={`block px-4 py-3 mb-2 rounded-lg transition-colors ${
              isActive('/chatbot-test')
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Chatbot Test
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
