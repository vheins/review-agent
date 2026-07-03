import React from 'react';
import { Sparkles, GitPullRequest, BarChart3, Users, ShieldAlert, ClipboardList, Logs } from 'lucide-react';
import { Card } from './ui/card.jsx';
import { useDashboard } from '../context/DashboardContext.tsx';
import { cn } from '../lib/utils.js';
import type { Tab, TabId } from '../types/index.ts';

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'prs', label: 'PRs', icon: GitPullRequest },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'security', label: 'Security', icon: ShieldAlert },
  { id: 'config', label: 'Configuration', icon: ClipboardList },
  { id: 'logs', label: 'Logs', icon: Logs },
];

const TAB_KEYS: Record<TabId, string> = {
  overview: '⌘1', prs: '⌘2', metrics: '⌘3', team: '⌘4',
  security: '⌘5', config: '⌘6', logs: '⌘7',
};

export const Sidebar = React.memo(function Sidebar() {
  const { selectedTab, setSelectedTab } = useDashboard();

  return (
    <aside className="border-b border-border bg-card px-4 py-5 md:px-5 xl:border-b-0 xl:border-r">
      <div className="sidebar-stack mx-auto flex max-w-7xl flex-col gap-6 xl:max-w-none">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-panel text-lg">🥷</div>
            <div className="min-w-0">
              <p className="eyebrow">Personal AI Ops</p>
              <h1 className="whitespace-nowrap text-[1.2rem] font-black tracking-tight md:text-[1.35rem]">Agentic Bunshin</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Daily-use review console for queue pressure, repository policy, and agent execution.</p>
        </Card>
        <nav className="scroll-slim grid auto-cols-[minmax(8.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto rounded-xl border border-border bg-background p-3 xl:grid-flow-row xl:auto-cols-auto xl:overflow-visible" aria-label="Main navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition',
                  selectedTab === tab.id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
                aria-current={selectedTab === tab.id ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{tab.label}</span>
                <span className="hidden text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 xl:inline">{TAB_KEYS[tab.id]}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
});
