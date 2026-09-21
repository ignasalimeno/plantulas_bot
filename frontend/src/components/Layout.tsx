import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChatWidget } from './ChatWidget'

interface LayoutProps {
  children: ReactNode
}

function TentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 20h18L12 4 3 20z" />
      <path d="M12 20v-6" />
    </svg>
  )
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 9-9 3 0 5 1 7 2 0 6-4 14-9 14z" />
      <path d="M11 20c0-5 2-9 5-12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/indoors', label: 'Indoors', icon: TentIcon, nested: false },
  { to: '/plants', label: 'Plantas', icon: LeafIcon, nested: true },
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
  const [collapsed, setCollapsed] = useState(true)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const currentSection = (() => {
    if (location.pathname.startsWith('/indoors/')) return 'Indoors / Detalle'
    const match = NAV_ITEMS.find((i) => isActive(i.to))
    return match ? match.label : 'Indoors'
  })()

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-14' : 'w-64'
        } bg-white border-r border-gray-200 flex flex-col shrink-0 transition-[width] duration-200`}
      >
        {/* Brand + toggle */}
        <div className={`border-b border-gray-200 ${collapsed ? 'px-2 py-4' : 'px-5 py-5'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <span className="led bg-blue-500 animate-pulse" />
              <button
                onClick={() => setCollapsed(false)}
                title="Expandir"
                className="text-gray-500 hover:text-gray-800 text-sm leading-none"
              >
                »
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
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
              <button
                onClick={() => setCollapsed(true)}
                title="Colapsar"
                className="text-gray-500 hover:text-gray-800 text-sm leading-none shrink-0"
              >
                «
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-2 py-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center mb-1 rounded-sm text-xs uppercase tracking-wider border-l-2 transition-colors ${
                  collapsed ? 'justify-center px-2 py-2' : 'gap-3 py-2'
                } ${!collapsed && item.nested ? 'pl-9 pr-3' : !collapsed ? 'px-3' : ''} ${
                  active
                    ? 'border-blue-500 bg-gray-100 text-blue-500'
                    : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Icon className={active ? 'text-blue-500' : 'text-gray-500'} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {!collapsed && (
          <div className="px-5 py-4 border-t border-gray-200">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">v0.1.0 // ok</p>
          </div>
        )}
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

      <ChatWidget />
    </div>
  )
}
