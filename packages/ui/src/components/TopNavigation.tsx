import React, { useState, useRef, useEffect } from 'react';
import {
  PlayCircle, RefreshCw, Zap, SquareTerminal, GitPullRequest, ListTodo,
  Plus, MessageSquarePlus, SunMedium, MoonStar, LaptopMinimal,
} from 'lucide-react';
import { Button } from './ui/button.tsx';
import { Badge } from './ui/badge.jsx';
import { useTheme } from '../hooks/useTheme.ts';
import { useDashboard } from '../context/DashboardContext.tsx';
import { cn } from '../lib/utils.js';
import { statusDotClass } from '../lib/formatters.js';

export function TopNavigation() {
  const { themeMode, cycleTheme } = useTheme();
  const {
    snapshot, running, wsStatus, apiStatus,
    handleStart, handleStop, handleExecuteNow,
    refreshSnapshot, refreshPRs, refreshTeamSecurity, refreshRepositoryConfig,
    appendLog,
  } = useDashboard();

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('button[type="button"]')) {
        setShowCreateMenu(false);
      }
    }
    if (showCreateMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCreateMenu]);

  const themeIcon = themeMode === 'light' ? SunMedium : themeMode === 'dark' ? MoonStar : LaptopMinimal;
  const ThemeIcon = themeIcon;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-base">🥷</div>
          <div className="hidden flex-col sm:flex">
            <h1 className="text-sm font-bold leading-tight tracking-tight">Agentic Bunshin</h1>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(running))} />
                {running ? 'Loop Active' : 'Standby'}
              </div>
              <span className="opacity-30">•</span>
              <div className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', wsStatus === 'Connected' ? 'bg-emerald-500' : 'bg-rose-500')} />
                Realtime
              </div>
              <span className="opacity-30">•</span>
              <div className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', apiStatus === 'Connected' ? 'bg-emerald-500' : 'bg-amber-500')} />
                API
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {snapshot?.repositories && (
            <div className="mr-2 hidden items-center gap-2 rounded-lg border border-border bg-panel/30 px-2.5 py-1 text-xs font-medium xl:flex">
              <span className="text-muted-foreground">Repos</span>
              <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1 font-bold">{snapshot.repositories.length}</Badge>
            </div>
          )}

          <div className="mr-2 flex items-center gap-1.5 rounded-lg border border-border bg-panel/50 p-1">
            <Button size="sm" variant="ghost" disabled={running} className="h-8 gap-1.5 px-2.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleStart(false)}>
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Start</span>
            </Button>
            <Button size="sm" variant="ghost" disabled={running} className="h-8 gap-1.5 px-2.5 text-xs font-bold text-amber-500 hover:bg-amber-500/10" onClick={() => handleStart(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Run Once</span>
            </Button>
            <Button size="sm" variant="ghost" disabled={!running} className="h-8 gap-1.5 px-2.5 text-xs font-bold text-sky-500 hover:bg-sky-500/10" onClick={handleExecuteNow}>
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Execute Now</span>
            </Button>
            <Button size="sm" variant="ghost" disabled={!running} className="h-8 gap-1.5 px-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10" onClick={handleStop}>
              <SquareTerminal className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Stop</span>
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs font-bold text-sky-400 hover:bg-sky-500/10" onClick={async () => {
              appendLog('info', 'Scanning for new PRs...');
              const result = await (await import('../api-helper.js')).api.scanPRs();
              if (result.success) { appendLog('info', 'PR scan completed successfully'); await refreshSnapshot(); await refreshPRs(); }
              else appendLog('error', `PR scan failed: ${result.error}`);
            }}>
              <GitPullRequest className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Fetch PRs</span>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10" onClick={async () => {
              appendLog('info', 'Scanning for new issues...');
              const result = await (await import('../api-helper.js')).api.scanIssues();
              if (result.success) appendLog('info', 'Issue scan completed successfully');
              else appendLog('error', `Issue scan failed: ${result.error}`);
            }}>
              <ListTodo className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Fetch Issues</span>
            </Button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </button>
            {showCreateMenu && (
              <div ref={createMenuRef} className="absolute right-0 top-full z-[60] mt-2 w-48 rounded-lg border border-border bg-card shadow-lg">
                <div className="p-2">
                  <button type="button" onClick={() => { setShowCreateMenu(false); appendLog('info', 'Create Task clicked'); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary">
                    <ListTodo className="h-4 w-4" /> Create Task
                  </button>
                  <button type="button" onClick={() => { setShowCreateMenu(false); appendLog('info', 'New Chat clicked'); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary">
                    <MessageSquarePlus className="h-4 w-4" /> New Chat
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={cycleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title={`Theme: ${themeMode}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
