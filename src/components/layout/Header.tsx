import React from 'react'
import { Settings, Moon, Sun, Menu, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface HeaderProps {
  onMenuToggle?: () => void
  onSettingsClick?: () => void
  isDarkMode?: boolean
  onThemeToggle?: () => void
  notificationCount?: number
  onNotificationClick?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  onSettingsClick,
  isDarkMode = false,
  onThemeToggle,
  notificationCount = 0,
  onNotificationClick,
}) => {
  return (
    <Card className="sticky top-0 z-50 border-0 rounded-none aboutwater-gradient shadow-xl" glass={false}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left section - Logo and brand */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 md:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src="/logo.png"
                alt="AboutWater Logo"
                className="h-12 w-12 rounded-full border-2 border-white/50 object-contain bg-white/10 backdrop-blur-sm"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  // Show fallback emoji
                  const fallback = document.createElement('div')
                  fallback.className = 'h-12 w-12 rounded-full border-2 border-white/50 bg-white/20 flex items-center justify-center text-xl'
                  fallback.textContent = '💧'
                  target.parentNode?.insertBefore(fallback, target)
                }}
              />
            </div>
            
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-white text-shadow">
                AboutWater Route Optimizer
              </h1>
              <p className="text-sm text-white/80 font-medium">
                making water your water
              </p>
            </div>
          </div>
        </div>

        {/* Right section - Controls */}
        <div className="flex items-center space-x-2">
          {/* System status indicator */}
          <div className="hidden md:flex items-center space-x-3 mr-4">
            <div className="flex items-center space-x-2 text-white/90 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse-slow"></div>
              <span className="hidden lg:inline">System Online</span>
            </div>
            <div className="text-white/70 text-sm">
              v4.0.0
            </div>
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-white hover:bg-white/20"
            onClick={onNotificationClick}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              </div>
            )}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onThemeToggle}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onSettingsClick}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Progress bar for active optimization */}
      <div className="h-1 bg-white/20 relative overflow-hidden">
        <div className="h-full bg-white/40 animate-pulse absolute inset-0 opacity-0" id="optimization-progress" />
      </div>
    </Card>
  )
}

export default Header