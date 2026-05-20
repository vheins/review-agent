import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { useTheme } from './hooks/useTheme.ts';
import { useKeyboard, getTabShortcuts } from './hooks/useKeyboard.ts';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { DashboardProvider, useDashboard } from './context/DashboardContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { TopNavigation } from './components/TopNavigation.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { PRDetailSlideOver } from './components/PRDetailSlideOver.tsx';
import { OverviewSkeleton } from './components/LoadingSkeleton.tsx';
import { api } from './api-helper.js';
import type { RuntimeConfig, TabId } from './types/index.ts';

const OverviewTab = lazy(() => import('./components/OverviewTab.tsx').then(m => ({ default: m.OverviewTab })));
const PRsTab = lazy(() => import('./components/PRsTab.tsx').then(m => ({ default: m.PRsTab })));
const MetricsTab = lazy(() => import('./components/MetricsTab.tsx').then(m => ({ default: m.MetricsTab })));
const TeamTab = lazy(() => import('./components/TeamTab.tsx').then(m => ({ default: m.TeamTab })));
const SecurityTab = lazy(() => import('./components/SecurityTab.tsx').then(m => ({ default: m.SecurityTab })));
const ConfigTab = lazy(() => import('./components/ConfigTab.tsx').then(m => ({ default: m.ConfigTab })));
const LogsTab = lazy(() => import('./components/LogsTab.tsx').then(m => ({ default: m.LogsTab })));

const TAB_COMPONENTS: Record<TabId, React.LazyExoticComponent<any>> = {
  overview: OverviewTab,
  prs: PRsTab,
  metrics: MetricsTab,
  team: TeamTab,
  security: SecurityTab,
  config: ConfigTab,
  logs: LogsTab,
};

function TabContent() {
  const { selectedTab, snapshot } = useDashboard();
  const Component = TAB_COMPONENTS[selectedTab];
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <ErrorBoundary key={selectedTab}>
        <Component />
      </ErrorBoundary>
    </Suspense>
  );
}

function PRDetailPanel() {
  const { selectedPrId, prs, setSelectedPrId } = useDashboard();
  if (!selectedPrId) return null;
  const pr = prs.find(p => p.id === selectedPrId);
  if (!pr) return null;
  return <PRDetailSlideOver pr={pr} onClose={() => setSelectedPrId(null)} />;
}

function DashboardShell() {
  const { setSelectedTab, appendLog, refreshSnapshot, refreshPRs, refreshTeamSecurity, setWsStatus } = useDashboard();
  const { themeMode } = useTheme();

  const keyboardShortcuts = useMemo(() => getTabShortcuts(setSelectedTab), [setSelectedTab]);
  useKeyboard(keyboardShortcuts);

  // WebSocket integration
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    (async () => {
      const result = await (window as any).electronAPI?.getRuntimeConfig?.();
      if (!result) {
        setRuntimeConfig({
          apiBaseUrl: 'http://127.0.0.1:30001/api',
          wsUrl: 'ws://127.0.0.1:30001/ws',
          wsUserId: 'web-user',
          wsToken: 'web-token',
        });
      } else if (result.success) {
        setRuntimeConfig(result.config);
        api.setBaseUrl(result.config.apiBaseUrl);
      }
    })();
  }, []);

  const onWsMessage = useCallback((data: any) => {
    if (['review_started', 'review_progress', 'review_completed', 'review_failed', 'metrics_update', 'pr_update', 'health_alert'].includes(data.type)) {
      refreshSnapshot();
      refreshPRs();
      if (data.type === 'health_alert') refreshTeamSecurity();
    }
  }, [refreshSnapshot, refreshPRs, refreshTeamSecurity]);

  const { status: wsStatus, isConnected: _ic } = useWebSocket({
    url: runtimeConfig?.wsUrl ?? '',
    userId: runtimeConfig?.wsUserId ?? '',
    token: runtimeConfig?.wsToken ?? '',
    onMessage: onWsMessage,
  });

  useEffect(() => {
    setWsStatus(wsStatus);
  }, [wsStatus, setWsStatus]);

  return (
    <div className="relative min-h-screen">
      <TopNavigation />
      <div className="shell-grid">
        <Sidebar />
        <main className="px-3 py-3 md:px-6 md:py-4 xl:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <TabContent />
          </div>
        </main>
      </div>
      <PRDetailPanel />
      <ToastContainer />
    </div>
  );
}

import { useMemo } from 'react';

export default function App() {
  return (
    <DashboardProvider runtimeConfig={null}>
      <DashboardShell />
    </DashboardProvider>
  );
}
