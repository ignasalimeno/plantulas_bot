import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

const NAV_ITEMS = [
  { to: '/panel', label: 'Panel' },
  { to: '/indoors', label: 'Indoors' },
  { to: '/plants', label: 'Plantas' },
  { to: '/chat', label: 'Chatbot' },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-gray-700">
      {now.toLocaleTimeString('es-ES', { hour12: false })}
    </span>
  )
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [telegramUserId, setTelegramUserId] = useState<string>('12345678')

  useEffect(() => {
    const stored = localStorage.getItem('telegram_user_id')
    if (stored) {
      setTelegramUserId(stored)
    } else {
      localStorage.setItem('telegram_user_id', '12345678')
    }
  }, [])

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTelegramUserId(value)
    localStorage.setItem('telegram_user_id', value)
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const currentSection = (() => {
    if (location.pathname.startsWith('/indoors/')) return 'Indoors / Detalle'
    const match = NAV_ITEMS.find((i) => isActive(i.to))
    return match ? match.label : 'Panel'
  })()

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="led bg-blue-500 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-widest text-blue-500">
              PlantulasBot
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
            // terminal de cultivo
          </p>
        </div>

        {/* Telegram User ID Input */}
        <div className="px-5 py-4 border-b border-gray-200">
          <label className="field-label">Usuario Telegram</label>
          <input
            type="text"
            value={telegramUserId}
            onChange={handleUserIdChange}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="12345678"
          />
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 mb-1 rounded-sm text-xs uppercase tracking-wider border-l-2 transition-colors ${
                  active
                    ? 'border-blue-500 bg-gray-100 text-blue-500'
                    : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span className={active ? 'text-blue-500' : 'text-gray-500'}>
                  {active ? '>' : '·'}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-gray-200">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            v0.1.0 // ok
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Status bar */}
        <header className="flex items-center justify-between px-8 py-3 border-b border-gray-200 bg-white">
          <div className="text-[11px] uppercase tracking-widest text-gray-500">
            [ plantulas <span className="text-blue-500">//</span>{' '}
            <span className="text-gray-700">{currentSection}</span> ]
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-gray-500">
            <span className="led bg-blue-500 animate-pulse" />
            <span>online</span>
            <Clock />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">{children}</div>
      </main>
    </div>
  )
}
