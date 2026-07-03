import { createContext, useContext, useCallback, useState, useRef, useEffect, useDeferredValue, type ReactNode, startTransition } from 'react';
import { api } from '../api-helper.js';
import type {
  DashboardSnapshot, PR, PRMeta, PRFilters, FilterOptions,
  TeamSecurityData, ConfigData, ConfigFormState, RuleFormState,
  RuntimeConfig, LogEntry, ViewMode, TabId, ToastType,
} from '../types/index.ts';
import { addToast } from '../hooks/useToast.ts';

interface DashboardContextValue {
  selectedTab: TabId; setSelectedTab: (tab: TabId) => void;
  rangeDays: number; setRangeDays: (d: number) => void;
  snapshot: DashboardSnapshot | null;
  prs: PR[]; prMeta: PRMeta; prFilters: PRFilters; filterOptions: FilterOptions;
  viewMode: ViewMode; setViewMode: (m: ViewMode) => void;
  currentPage: number; setCurrentPage: (p: number) => void;
  selectedPrId: number | null; setSelectedPrId: (id: number | null) => void;
  teamSecurity: TeamSecurityData | null;
  configData: ConfigData | null; repositoryId: string;
  running: boolean;
  logs: LogEntry[]; setLogs: (l: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => void;
  logContainerRef: React.RefObject<HTMLDivElement | null>;
  wsStatus: string; setWsStatus: (s: string) => void; apiStatus: string;
  configForm: ConfigFormState; configValidation: string; ruleForm: RuleFormState; ruleFeedback: string;
  appendLog: (type: LogEntry['type'], message: string) => void;
  refreshSnapshot: (days?: number) => Promise<DashboardSnapshot | null>;
  refreshPRs: (extra?: Partial<PRFilters & { page: number }>) => Promise<void>;
  refreshTeamSecurity: () => Promise<void>;
  refreshRepositoryConfig: (id: string) => Promise<void>;
  toggleAvailability: (dev: any) => Promise<void>;
  handleStart: (once: boolean) => Promise<void>;
  handleStop: () => Promise<void>;
  handleExecuteNow: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleSaveConfig: (e: React.FormEvent) => Promise<void>;
  handleTestRule: () => Promise<void>;
  handleSaveRule: (e: React.FormEvent) => Promise<void>;
  setPrFilters: (f: PRFilters | ((prev: PRFilters) => PRFilters)) => void;
  setConfigForm: (f: ConfigFormState | ((prev: ConfigFormState) => ConfigFormState)) => void;
  setConfigValidation: (v: string) => void;
  setRuleForm: (f: RuleFormState | ((prev: RuleFormState) => RuleFormState)) => void;
  setRuleFeedback: (f: string) => void;
  setRepositoryId: (id: string) => void;
  setShowFilterModal: (v: boolean) => void;
  showFilterModal: boolean;
  filterMenuRef: React.RefObject<HTMLDivElement | null>;
  deferredSearch: string;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const defaultRuleSample = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';

const DEFAULT_CONFIG_FORM: ConfigFormState = {
  reviewInterval: '600', reviewMode: 'comment', aiExecutor: 'gemini',
  autoMerge: 'true', severityThreshold: '10', autoMergeHealthThreshold: '60',
  logLevel: 'info', requiredChecks: 'tests,review',
};

const DEFAULT_RULE_FORM: RuleFormState = {
  id: '', rule_name: '', rule_type: 'regex', severity: 'critical',
  pattern: '', message: '', sampleCode: defaultRuleSample,
};

export function DashboardProvider({ children, runtimeConfig }: { children: ReactNode; runtimeConfig: RuntimeConfig | null }) {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [rangeDays, setRangeDays] = useState(30);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [prs, setPrs] = useState<PR[]>([]);
  const [prMeta, setPrMeta] = useState<PRMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [prFilters, setPrFilters] = useState<PRFilters>({ status: '', repositoryId: '', authorId: '', search: '' });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ authors: [], repositories: [] });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null);
  const [teamSecurity, setTeamSecurity] = useState<TeamSecurityData | null>(null);
  const [configData, setConfigData] = useState<ConfigData | null>(null);
  const [repositoryId, setRepositoryId] = useState('');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [apiStatus, setApiStatus] = useState('Unknown');
  const [configForm, setConfigForm] = useState<ConfigFormState>(DEFAULT_CONFIG_FORM);
  const [configValidation, setConfigValidation] = useState('Select a repository to load its current configuration.');
  const [ruleForm, setRuleForm] = useState<RuleFormState>(DEFAULT_RULE_FORM);
  const [ruleFeedback, setRuleFeedback] = useState('Rule validation output will appear here.');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(prFilters.search);

  const appendLog = useCallback((type: LogEntry['type'], message: string) => {
    const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
    startTransition(() => {
      setLogs((prev) => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message: `[${new Date().toLocaleTimeString()}] ${msgStr.trim()}`,
      }].slice(-200));
    });
  }, []);

  const refreshSnapshot = useCallback(async (days = rangeDays) => {
    const result = await api.getDashboardSnapshot({ rangeDays: days });
    if (!result.success) {
      const err = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      setApiStatus(err);
      appendLog('error', err);
      return null;
    }
    setSnapshot(result.snapshot);
    setApiStatus('Connected');
    return result.snapshot;
  }, [rangeDays, appendLog]);

  const refreshPRs = useCallback(async (extra: Partial<PRFilters & { page: number }> = {}) => {
    const filters = { ...prFilters, ...extra };
    const result = await api.listPRs({
      status: filters.status || '', repositoryId: filters.repositoryId || '',
      authorId: filters.authorId || '', search: filters.search || '',
      page: filters.page || currentPage, limit: 10,
    });
    if (!result.success) { appendLog('error', result.error); return; }
    if (result.meta) { setPrs(result.data || []); setPrMeta(result.meta); }
    else { setPrs(result.prs || []); }
    const fResult = await api.getPRFilters();
    if (fResult?.success) setFilterOptions({ authors: fResult.authors || [], repositories: fResult.repositories || [] });
  }, [prFilters, currentPage, appendLog]);

  const refreshTeamSecurity = useCallback(async () => {
    const result = await api.getTeamSecurityData();
    if (result.success) setTeamSecurity(result.data);
    else appendLog('error', result.error);
  }, [appendLog]);

  const refreshRepositoryConfig = useCallback(async (nextId: string) => {
    const id = Number(nextId || repositoryId);
    if (!id) return;
    const result = await api.getRepositoryConfigData(id);
    if (!result.success) { setConfigValidation(result.error); return; }
    setConfigData(result.payload);
    setRepositoryId(String(id));
    setConfigValidation(`Editing ${result.payload.repository.full_name} on ${result.payload.repository.default_branch}.`);
    const c = result.payload.config;
    setConfigForm({
      reviewInterval: String(c.reviewInterval ?? 600),
      reviewMode: c.reviewMode ?? 'comment',
      aiExecutor: c.aiExecutor ?? 'gemini',
      autoMerge: String(Boolean(c.autoMerge)),
      severityThreshold: String(c.severityThreshold ?? 10),
      autoMergeHealthThreshold: String(c.autoMergeHealthThreshold ?? 60),
      logLevel: c.logLevel ?? 'info',
      requiredChecks: Array.isArray(c.requiredChecks) ? c.requiredChecks.join(',') : String(c.requiredChecks ?? 'tests,review'),
    });
  }, [repositoryId]);

  const toggleAvailability = useCallback(async (developer: any) => {
    const result = await api.setDeveloperAvailability({
      developerId: developer.id,
      isAvailable: !developer.is_available,
      unavailableUntil: developer.is_available ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : null,
    });
    if (result.success) { await refreshTeamSecurity(); await refreshSnapshot(); }
    else appendLog('error', result.error);
  }, [refreshTeamSecurity, refreshSnapshot, appendLog]);

  const handleStart = useCallback(async (once: boolean) => {
    const apiResult = once ? await api.startOnce() : await api.startContinuous();
    if (apiResult.success) {
      if (!once) setRunning(true);
      appendLog('info', once ? 'Single review started' : 'Review loop started');
      return;
    }
    const electronResult = await (window as any).electronAPI?.startReview?.({ once });
    if (electronResult?.success) {
      if (!once) setRunning(true);
      appendLog('info', once ? 'Single review started' : 'Review loop started');
    } else {
      appendLog('error', electronResult?.message || apiResult.error || 'Failed to start review');
    }
  }, [appendLog]);

  const handleStop = useCallback(async () => {
    const apiResult = await api.stopReview();
    if (apiResult.success) {
      setRunning(false);
      appendLog('info', 'Stop requested — will stop after current review completes');
      return;
    }
    const electronResult = await (window as any).electronAPI?.stopReview?.();
    if (electronResult?.success) {
      setRunning(false);
      appendLog('info', 'Stop requested — will stop after current review completes');
    } else {
      appendLog('error', electronResult?.message || apiResult.error || 'Failed to stop review');
    }
  }, [appendLog]);

  const handleExecuteNow = useCallback(async () => {
    const apiResult = await api.startOnce();
    if (apiResult.success) {
      appendLog('info', 'Single review triggered');
      return;
    }
    const electronResult = await (window as any).electronAPI?.executeNow?.();
    if (electronResult?.success) {
      appendLog('info', 'Single review triggered');
    } else {
      appendLog('error', electronResult?.message || apiResult.error || 'Failed to execute review');
    }
  }, [appendLog]);

  const handleExport = useCallback(async () => {
    const result = await api.exportMetricsData({
      filters: {
        startDate: new Date(Date.now() - rangeDays * 86400000).toISOString(),
        endDate: new Date().toISOString(),
      }, format: 'csv',
    });
    appendLog(result.success ? 'info' : 'error',
      result.success ? `Export created: ${result.result.fileName}` : result.error);
  }, [rangeDays, appendLog]);

  const handleSaveConfig = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.saveRepositoryConfigData({
      repoName: Number(repositoryId),
      config: {
        ...configForm,
        reviewInterval: Number(configForm.reviewInterval),
        severityThreshold: Number(configForm.severityThreshold),
        autoMergeHealthThreshold: Number(configForm.autoMergeHealthThreshold),
        autoMerge: configForm.autoMerge === 'true',
        requiredChecks: String(configForm.requiredChecks).split(',').map((v) => v.trim()).filter(Boolean),
      },
    });
    setConfigValidation(result.success ? 'Configuration saved successfully.' : result.error);
    if (result.success) { await refreshRepositoryConfig(repositoryId); addToast('success', 'Configuration saved'); }
  }, [repositoryId, configForm, refreshRepositoryConfig]);

  const handleTestRule = useCallback(async () => {
    const result = await api.testCustomRule({
      rule: {
        id: ruleForm.id ? Number(ruleForm.id) : undefined,
        rule_name: ruleForm.rule_name, rule_type: ruleForm.rule_type,
        severity: ruleForm.severity, pattern: ruleForm.pattern, message: ruleForm.message,
      }, sampleCode: ruleForm.sampleCode,
    });
    setRuleFeedback(result.success ? `Rule matched ${result.violations.length} violation(s).` : result.error);
  }, [ruleForm]);

  const handleSaveRule = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.saveCustomRule({
      repositoryId: Number(repositoryId),
      rule: {
        id: ruleForm.id ? Number(ruleForm.id) : undefined,
        rule_name: ruleForm.rule_name, rule_type: ruleForm.rule_type,
        severity: ruleForm.severity, pattern: ruleForm.pattern, message: ruleForm.message,
      },
    });
    setRuleFeedback(result.success ? `Rule saved with id ${result.ruleId}.` : result.error);
    if (result.success) {
      setRuleForm(DEFAULT_RULE_FORM);
      await refreshRepositoryConfig(repositoryId);
      addToast('success', 'Rule saved');
    }
  }, [repositoryId, ruleForm, refreshRepositoryConfig]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Filter change => reset page 1
  const prevFiltersRef = useRef(prFilters);
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed = prev.status !== prFilters.status || prev.repositoryId !== prFilters.repositoryId ||
      prev.authorId !== prFilters.authorId || prev.search !== deferredSearch;
    prevFiltersRef.current = prFilters;
    if (changed) { setCurrentPage(1); refreshPRs({ page: 1 }); }
    else { refreshPRs({ page: currentPage }); }
  }, [currentPage, prFilters, deferredSearch, refreshPRs]);

  // Init load
  useEffect(() => {
    if (!runtimeConfig) return;
    let mounted = true;
    (async () => {
      const snap = await refreshSnapshot(rangeDays);
      await refreshPRs();
      await refreshTeamSecurity();
      if (snap?.repositories?.length) {
        const id = String(snap.repositories[0].id);
        setRepositoryId(id);
        await refreshRepositoryConfig(id);
      }
      const fResult = await api.getPRFilters();
      if (fResult?.success) setFilterOptions({ authors: fResult.authors || [], repositories: fResult.repositories || [] });
      const statusResult = await api.getReviewStatus();
      if (statusResult.success) {
        setRunning(statusResult.isRunning ?? false);
      } else {
        const electronStatus = await (window as any).electronAPI?.getReviewStatus?.();
        if (electronStatus?.isRunning !== undefined) setRunning(electronStatus.isRunning);
      }
    })();
    (window as any).electronAPI?.onLogOutput?.((data: any) => appendLog(data.type, data.message));
    (window as any).electronAPI?.onReviewStopped?.((data: any) => {
      setRunning(false);
      appendLog('info', `Review process exited with code ${data.code}`);
    });
    return () => { mounted = false; };
  }, [runtimeConfig]);

  // Refresh on range change
  useEffect(() => { refreshSnapshot(rangeDays); }, [rangeDays]);

  // PR detail fetch
  useEffect(() => {
    if (!selectedPrId) return;
    const pr = prs.find(p => p.id === selectedPrId);
    if (!pr) return;
    api.getPRById(pr.id);
  }, [selectedPrId, prs]);

  const value: DashboardContextValue = {
    selectedTab, setSelectedTab, rangeDays, setRangeDays,
    snapshot, prs, prMeta, prFilters, setPrFilters, filterOptions,
    viewMode, setViewMode, currentPage, setCurrentPage,
    selectedPrId, setSelectedPrId, teamSecurity,
    configData, repositoryId, setRepositoryId, running,
    logs, setLogs, logContainerRef, wsStatus, setWsStatus,
    apiStatus, configForm, setConfigForm, configValidation, setConfigValidation,
    ruleForm, setRuleForm, ruleFeedback, setRuleFeedback,
    deferredSearch, showFilterModal, setShowFilterModal, filterMenuRef,
    appendLog, refreshSnapshot, refreshPRs, refreshTeamSecurity,
    refreshRepositoryConfig, toggleAvailability,
    handleStart, handleStop, handleExecuteNow, handleExport,
    handleSaveConfig, handleTestRule, handleSaveRule,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
