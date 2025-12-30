'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { RefreshCw, User, ChevronDown, LogOut } from 'lucide-react';

interface DashboardHeaderProps {
  username?: string;
  isLoading: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
}

export function DashboardHeader({
  username,
  isLoading,
  onRefresh,
  onSignOut,
}: DashboardHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#4B7BF5] text-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title - Left aligned */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-black rounded-lg overflow-hidden">
            <Image
              src="/CMC_LOGO.svg"
              alt="Logo"
              width={40}
              height={40}
              className="invert"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-white/80">Cincinnati Museum Center</p>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 h-10 px-4 bg-white text-[#4B7BF5] font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-70"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* User Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 h-10 px-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4B7BF5] rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {username}
                      </p>
                      <p className="text-xs text-slate-500">Administrator</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
