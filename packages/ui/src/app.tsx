import React, { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useState, useRef } from 'react';
import {
    Clock3,
    GitPullRequest,
    LaptopMinimal,
    Logs,
    MoonStar,
    PlayCircle,
    Plus,
    RefreshCw,
    Settings2,
    Sparkles,
    SquareTerminal,
    SunMedium,
    Users,
    MessageSquarePlus,
    ListTodo,
    Zap,
    BarChart3,
    ShieldAlert,
    ClipboardList
} from 'lucide-react';
import { Button } from './components/ui/button.jsx';
import { Card } from './components/ui/card.jsx';
import { Badge } from './components/ui/badge.jsx';
import { cn } from './lib/utils.js';
import { api } from './api-helper.js';

import { OverviewTab } from './components/OverviewTab.tsx';
import { PRsTab } from './components/PRsTab.tsx';
import { MetricsTab } from './components/MetricsTab.tsx';
import { TeamTab } from './components/TeamTab.tsx';
import { SecurityTab } from './components/SecurityTab.tsx';
import { ConfigTab } from './components/ConfigTab.tsx';
import { LogsTab } from './components/LogsTab.tsx';

import { 
    getStoredThemeMode, 
    resolveTheme, 
    statusDotClass, 
    toneForStatus 
} from './lib/formatters.js';

const tabs = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'prs', label: 'PRs', icon: GitPullRequest },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'security', label: 'Security', icon: ShieldAlert },
    { id: 'config', label: 'Configuration', icon: ClipboardList },
    { id: 'logs', label: 'Logs', icon: Logs }
];

const defaultRuleSample = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';

export default function App() {
    const [selectedTab, setSelectedTab] = useState('overview');
    const [rangeDays, setRangeDays] = useState(30);
    const [themeMode, setThemeMode] = useState(getStoredThemeMode());
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const createMenuRef = useRef(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const filterMenuRef = useRef(null);
    const [runtimeConfig, setRuntimeConfig] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [prs, setPrs] = useState([]);
    const [prMeta, setPrMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [filterOptions, setFilterOptions] = useState({ authors: [], repositories: [] });
    const [selectedPrId, setSelectedPrId] = useState(null);
    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
    const [prDetail, setPrDetail] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [teamSecurity, setTeamSecurity] = useState(null);
    const [configData, setConfigData] = useState(null);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const logContainerRef = useRef(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);
    const [wsStatus, setWsStatus] = useState('Disconnected');
    const [apiStatus, setApiStatus] = useState('Unknown');
    const [repositoryId, setRepositoryId] = useState('');
    const [configValidation, setConfigValidation] = useState('Select a repository to load its current configuration.');
    const [ruleFeedback, setRuleFeedback] = useState('Rule validation output will appear here.');
    const [prFilters, setPrFilters] = useState({
        status: '',
        repositoryId: '',
        authorId: '',
        search: ''
    });
    const [configForm, setConfigForm] = useState({
        reviewInterval: 600,
        reviewMode: 'comment',
        aiExecutor: 'gemini',
        autoMerge: 'true',
        severityThreshold: 10,
        autoMergeHealthThreshold: 60,
        logLevel: 'info',
        requiredChecks: 'tests,review'
    });
    const [ruleForm, setRuleForm] = useState({
        id: '',
        rule_name: '',
        rule_type: 'regex',
        severity: 'critical',
        pattern: '',
        message: '',
        sampleCode: defaultRuleSample
    });
    const deferredSearch = useDeferredValue(prFilters.search);

    const applyTheme = useEffectEvent((mode) => {
        const resolvedTheme = resolveTheme(mode);
        document.body.dataset.theme = resolvedTheme;
        document.documentElement.style.colorScheme = resolvedTheme;
        window.localStorage.setItem('agentic-bunshin-theme', mode);
    });

    useEffect(() => {
        applyTheme(themeMode);
    }, [themeMode, applyTheme]);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (themeMode === 'system') {
                applyTheme('system');
            }
        };
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, [themeMode, applyTheme]);

    // Close create menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (createMenuRef.current && !createMenuRef.current.contains(event.target) && !event.target.closest('button[type="button"]')) {
                setShowCreateMenu(false);
            }
        }
        
        if (showCreateMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showCreateMenu]);

    // Close filter menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target) && !event.target.closest('button[data-filter-toggle]')) {
                setShowFilterModal(false);
            }
        }
        
        if (showFilterModal) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showFilterModal]);

    const appendLog = useEffectEvent((type, message) => {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        
        startTransition(() => {
            setLogs((current) => [...current, { id: `${Date.now()}-${Math.random()}`, type, message: `[${new Date().toLocaleTimeString()}] ${messageStr.trim()}` }].slice(-200));
        });
    });

    const refreshSnapshot = useEffectEvent(async (days = rangeDays) => {
        const result = await api.getDashboardSnapshot({ rangeDays: days });
        if (!result.success) {
            const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
            setApiStatus(errorMsg);
            appendLog('error', errorMsg);
            return null;
        }

        setSnapshot(result.snapshot);
        setApiStatus('Connected');
        return result.snapshot;
    });

    const refreshPRs = useEffectEvent(async (extraFilters = {}) => {
        const filtersToUse = { ...prFilters, ...extraFilters };
        const result = await api.listPRs({
            status: filtersToUse.status || '',
            repositoryId: filtersToUse.repositoryId || '',
            authorId: filtersToUse.authorId || '',
            search: filtersToUse.search || '',
            page: filtersToUse.page || currentPage,
            limit: itemsPerPage
        });
        if (!result.success) {
            appendLog('error', result.error);
            return;
        }

        if (result.meta) {
            setPrs(result.data || []);
            setPrMeta(result.meta);
            setSelectedPrId((current) => current ?? result.data?.[0]?.id ?? null);
        } else {
            setPrs(result.prs || []);
            setSelectedPrId((current) => current ?? result.prs?.[0]?.id ?? null);
        }
    });

    const refreshTeamSecurity = useEffectEvent(async () => {
        const result = await api.getTeamSecurityData();
        if (result.success) {
            setTeamSecurity(result.data);
        } else {
            appendLog('error', result.error);
        }
    });

    const refreshRepositoryConfig = useEffectEvent(async (nextRepositoryId) => {
        const currentRepositoryId = Number(nextRepositoryId || repositoryId);
        if (!currentRepositoryId) return;
        const result = await api.getRepositoryConfigData(currentRepositoryId);
        if (!result.success) {
            setConfigValidation(result.error);
            return;
        }
        setConfigData(result.payload);
        setRepositoryId(String(currentRepositoryId));
        setConfigValidation(`Editing ${result.payload.repository.full_name} on ${result.payload.repository.default_branch}.`);
        setConfigForm({
            reviewInterval: result.payload.config.reviewInterval ?? 600,
            reviewMode: result.payload.config.reviewMode ?? 'comment',
            aiExecutor: result.payload.config.aiExecutor ?? 'gemini',
            autoMerge: String(Boolean(result.payload.config.autoMerge)),
            severityThreshold: result.payload.config.severityThreshold ?? 10,
            autoMergeHealthThreshold: result.payload.config.autoMergeHealthThreshold ?? 60,
            logLevel: result.payload.config.logLevel ?? 'info',
            requiredChecks: Array.isArray(result.payload.config.requiredChecks) ? result.payload.config.requiredChecks.join(',') : String(result.payload.config.requiredChecks ?? 'tests,review')
        });
    });

    useEffect(() => {
        let mounted = true;

        (async () => {
            const runtimeResult = await window.electronAPI?.getRuntimeConfig();
            if (!mounted) return;
            
            if (!runtimeResult) {
                console.warn('Electron API not available. Using default config.');
                const defaultConfig = {
                    apiBaseUrl: 'http://127.0.0.1:3000/api',
                    wsUrl: 'ws://127.0.0.1:3000/ws',
                    wsUserId: 'web-user',
                    wsToken: 'web-token'
                };
                setRuntimeConfig(defaultConfig);
                api.setBaseUrl(defaultConfig.apiBaseUrl);
            } else if (!runtimeResult.success) {
                appendLog('error', runtimeResult.error);
                return;
            } else {
                setRuntimeConfig(runtimeResult.config);
                api.setBaseUrl(runtimeResult.config.apiBaseUrl);
            }

            const latestSnapshot = await refreshSnapshot(rangeDays);
            await refreshPRs(prFilters);
            await refreshTeamSecurity();
            if (latestSnapshot?.repositories?.length) {
                setRepositoryId(String(latestSnapshot.repositories[0].id));
                await refreshRepositoryConfig(latestSnapshot.repositories[0].id);
            }
            
            const filtersResult = await api.getPRFilters();
            if (filtersResult && filtersResult.success) {
                setFilterOptions({ authors: filtersResult.authors || [], repositories: filtersResult.repositories || [] });
            }
        })();

        window.electronAPI?.onLogOutput?.((data) => appendLog(data.type, data.message));
        window.electronAPI?.onReviewStopped?.((data) => {
            setRunning(false);
            appendLog('info', `Review process exited with code ${data.code}`);
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        refreshSnapshot(rangeDays);
    }, [rangeDays]);

    // When filters change, reset to page 1 and fetch; when only page changes, just fetch.
    const prevFiltersRef = React.useRef({ status: prFilters.status, repositoryId: prFilters.repositoryId, authorId: prFilters.authorId, search: deferredSearch });
    useEffect(() => {
        const prevFilters = prevFiltersRef.current;
        const filtersChanged =
            prevFilters.status !== prFilters.status ||
            prevFilters.repositoryId !== prFilters.repositoryId ||
            prevFilters.authorId !== prFilters.authorId ||
            prevFilters.search !== deferredSearch;

        prevFiltersRef.current = { status: prFilters.status, repositoryId: prFilters.repositoryId, authorId: prFilters.authorId, search: deferredSearch };

        if (filtersChanged) {
            setCurrentPage(1);
            refreshPRs({ page: 1 });
        } else {
            refreshPRs({ page: currentPage });
        }
    }, [currentPage, prFilters.status, prFilters.repositoryId, prFilters.authorId, deferredSearch]);

    useEffect(() => {
        if (!selectedPrId) return;
        (async () => {
            const pr = prs.find(p => p.id === selectedPrId);
            if (!pr) return;
            
            const result = await api.getPRDetail(pr.repository, pr.number);
            if (result.success) {
                setPrDetail(result.detail);
            }
        })();
    }, [selectedPrId, prs]);

    useEffect(() => {
        if (!runtimeConfig?.wsUrl) return undefined;

        let reconnectTimer;
        let reconnectDelay = 1000;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 3;
        let socket;
        let isIntentionallyClosed = false;

        const connect = () => {
            if (reconnectAttempts >= maxReconnectAttempts) {
                setWsStatus('Disconnected');
                return;
            }

            setWsStatus('Connecting');
            
            try {
                socket = new WebSocket(runtimeConfig.wsUrl);
                
                socket.addEventListener('open', () => {
                    reconnectDelay = 1000;
                    reconnectAttempts = 0;
                    setWsStatus('Connected');
                    socket.send(JSON.stringify({
                        type: 'auth',
                        userId: runtimeConfig.wsUserId,
                        token: runtimeConfig.wsToken
                    }));
                });

                socket.addEventListener('message', async (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'auth_success') {
                        socket.send(JSON.stringify({ type: 'subscribe', channel: 'dashboard' }));
                        return;
                    }
                    if (['review_started', 'review_progress', 'review_completed', 'review_failed', 'metrics_update', 'pr_update', 'health_alert'].includes(data.type)) {
                        await refreshSnapshot();
                        await refreshPRs();
                        if (data.type === 'health_alert') await refreshTeamSecurity();
                    }
                });

                socket.addEventListener('close', (event) => {
                    if (isIntentionallyClosed) {
                        setWsStatus('Disconnected');
                        return;
                    }
                    
                    if (event.wasClean) {
                        setWsStatus('Disconnected');
                    } else {
                        reconnectAttempts++;
                        if (reconnectAttempts < maxReconnectAttempts) {
                            setWsStatus('Reconnecting');
                            reconnectTimer = window.setTimeout(connect, reconnectDelay);
                            reconnectDelay = Math.min(reconnectDelay * 2, 15000);
                        } else {
                            setWsStatus('Disconnected');
                        }
                    }
                });

                socket.addEventListener('error', () => {
                    reconnectAttempts++;
                });
            } catch (error) {
                setWsStatus('Error');
                reconnectAttempts++;
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectTimer = window.setTimeout(connect, reconnectDelay);
                    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
                }
            }
        };

        connect();

        return () => {
            isIntentionallyClosed = true;
            window.clearTimeout(reconnectTimer);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close(1000, 'Component unmounting');
            }
        };
    }, [runtimeConfig]);

    const repositories = snapshot?.repositories ?? [];
    const authorOptions = filterOptions.authors;
    const repositoryOptions = filterOptions.repositories;
    
    // Backend handles all filtering server-side — filteredPrs is just the already-filtered page from the API
    const filteredPrs = useMemo(() => prs, [prs]);

    async function toggleAvailability(developer) {
        const result = await api.setDeveloperAvailability({
            developerId: developer.id,
            isAvailable: !developer.is_available,
            unavailableUntil: developer.is_available ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : null
        });
        if (result.success) {
            await refreshTeamSecurity();
            await refreshSnapshot();
        } else {
            appendLog('error', result.error);
        }
    }

    async function handleStart(once) {
        const result = await window.electronAPI?.startReview({ once });
        if (!result) {
            appendLog('warn', 'Start command only available in Electron');
            return;
        }
        if (result.success) {
            setRunning(true);
            appendLog('info', once ? 'Single review started' : 'Review loop started');
        } else {
            appendLog('error', result.message);
        }
    }

    async function handleExecuteNow() {
        const result = await window.electronAPI?.executeNow();
        if (!result) {
            appendLog('warn', 'Execute command only available in Electron');
            return;
        }
        appendLog(result.success ? 'info' : 'error', result.message);
    }

    async function handleStop() {
        const result = await window.electronAPI?.stopReview();
        if (!result) {
            appendLog('warn', 'Stop command only available in Electron');
            return;
        }
        if (result.success) {
            setRunning(false);
        }
        appendLog(result.success ? 'info' : 'error', result.message);
    }

    async function handleExport() {
        const result = await api.exportMetricsData({
            filters: {
                startDate: new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString()
            },
            format: 'csv'
        });
        appendLog(result.success ? 'info' : 'error', result.success ? `Export created: ${result.result.fileName}` : result.error);
    }

    async function handleSaveConfig(event) {
        event.preventDefault();
        const result = await api.saveRepositoryConfigData({
            repositoryId: Number(repositoryId),
            config: {
                ...configForm,
                reviewInterval: Number(configForm.reviewInterval),
                severityThreshold: Number(configForm.severityThreshold),
                autoMergeHealthThreshold: Number(configForm.autoMergeHealthThreshold),
                autoMerge: configForm.autoMerge === 'true',
                requiredChecks: String(configForm.requiredChecks).split(',').map((value) => value.trim()).filter(Boolean)
            }
        });
        setConfigValidation(result.success ? 'Configuration saved successfully.' : result.error);
        if (result.success) {
            await refreshRepositoryConfig(repositoryId);
        }
    }

    async function handleTestRule() {
        const result = await api.testCustomRule({
            rule: {
                id: ruleForm.id ? Number(ruleForm.id) : undefined,
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                severity: ruleForm.severity,
                pattern: ruleForm.pattern,
                message: ruleForm.message
            },
            sampleCode: ruleForm.sampleCode
        });
        setRuleFeedback(result.success ? `Rule matched ${result.violations.length} violation(s).` : result.error);
    }

    async function handleSaveRule(event) {
        event.preventDefault();
        const result = await api.saveCustomRule({
            repositoryId: Number(repositoryId),
            rule: {
                id: ruleForm.id ? Number(ruleForm.id) : undefined,
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                severity: ruleForm.severity,
                pattern: ruleForm.pattern,
                message: ruleForm.message
            }
        });
        setRuleFeedback(result.success ? `Rule saved with id ${result.ruleId}.` : result.error);
        if (result.success) {
            setRuleForm((current) => ({ ...current, id: '', rule_name: '', pattern: '', message: '', sampleCode: defaultRuleSample }));
            await refreshRepositoryConfig(repositoryId);
        }
    }

    const themeIcon = themeMode === 'light' ? SunMedium : themeMode === 'dark' ? MoonStar : LaptopMinimal;
    const ThemeIcon = themeIcon;

    return (
        <div className="relative min-h-screen">
            {/* Sticky Top Navigation */}
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
                        {/* Repositories Counter */}
                        {snapshot?.repositories && (
                            <div className="mr-2 hidden items-center gap-2 rounded-lg border border-border bg-panel/30 px-2.5 py-1 text-xs font-medium xl:flex">
                                <span className="text-muted-foreground">Repos</span>
                                <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1 font-bold">{snapshot.repositories.length}</Badge>
                            </div>
                        )}

                        {/* Agent Controls */}
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
                                const result = await api.scanPRs();
                                if (result.success) {
                                    appendLog('info', 'PR scan completed successfully');
                                    await refreshSnapshot();
                                    await refreshPRs();
                                } else {
                                    appendLog('error', `PR scan failed: ${result.error}`);
                                }
                            }}>
                                <GitPullRequest className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Fetch PRs</span>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10" onClick={async () => {
                                appendLog('info', 'Scanning for new issues...');
                                const result = await api.scanIssues();
                                if (result.success) {
                                    appendLog('info', 'Issue scan completed successfully');
                                } else {
                                    appendLog('error', `Issue scan failed: ${result.error}`);
                                }
                            }}>
                                <ListTodo className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Fetch Issues</span>
                            </Button>
                        </div>

                        {/* Create Button with Dropdown */}
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
                                <div
                                    ref={createMenuRef}
                                    className="absolute right-0 top-full z-[60] mt-2 w-48 rounded-lg border border-border bg-card shadow-lg"
                                >
                                    <div className="p-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateMenu(false);
                                                appendLog('info', 'Create Task clicked');
                                            }}
                                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary"
                                        >
                                            <ListTodo className="h-4 w-4" />
                                            Create Task
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateMenu(false);
                                                appendLog('info', 'New Chat clicked');
                                            }}
                                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary"
                                        >
                                            <MessageSquarePlus className="h-4 w-4" />
                                            New Chat
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Theme Switcher */}
                        <button
                            type="button"
                            onClick={() => {
                                const modes = ['system', 'dark', 'light'];
                                const currentIndex = modes.indexOf(themeMode);
                                const nextMode = modes[(currentIndex + 1) % modes.length];
                                setThemeMode(nextMode);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            title={`Theme: ${themeMode}`}
                        >
                            <ThemeIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="shell-grid">
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
                        <nav className="scroll-slim grid auto-cols-[minmax(8.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto rounded-xl border border-border bg-background p-3 xl:grid-flow-row xl:auto-cols-auto xl:overflow-visible">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedTab(tab.id)}
                                        className={cn('flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition', selectedTab === tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>
                <main className="px-3 py-3 md:px-6 md:py-4 xl:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col gap-5">
                        {selectedTab === 'overview' && (
                            <OverviewTab 
                                snapshot={snapshot}
                                rangeDays={rangeDays}
                                setRangeDays={setRangeDays}
                                refreshSnapshot={refreshSnapshot}
                                refreshPRs={refreshPRs}
                                refreshTeamSecurity={refreshTeamSecurity}
                                refreshRepositoryConfig={refreshRepositoryConfig}
                                setSelectedTab={setSelectedTab}
                                setSelectedPrId={setSelectedPrId}
                                apiStatus={apiStatus}
                                wsStatus={wsStatus}
                                running={running}
                                activityItems={snapshot?.recentActivity ?? []}
                            />
                        )}
                        {selectedTab === 'prs' && (
                            <PRsTab 
                                filteredPrs={filteredPrs}
                                prs={prs}
                                prFilters={prFilters}
                                setPrFilters={setPrFilters}
                                showFilterModal={showFilterModal}
                                setShowFilterModal={setShowFilterModal}
                                filterMenuRef={filterMenuRef}
                                repositories={repositoryOptions}
                                authorOptions={authorOptions}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                prMeta={prMeta}
                                itemsPerPage={itemsPerPage}
                                setSelectedPrId={setSelectedPrId}
                                deferredSearch={deferredSearch}
                            />
                        )}
                        {selectedTab === 'metrics' && (
                            <MetricsTab 
                                snapshot={snapshot}
                                rangeDays={rangeDays}
                                repositories={repositories}
                                handleExport={handleExport}
                            />
                        )}
                        {selectedTab === 'team' && (
                            <TeamTab 
                                teamSecurity={teamSecurity}
                                toggleAvailability={toggleAvailability}
                            />
                        )}
                        {selectedTab === 'security' && (
                            <SecurityTab 
                                teamSecurity={teamSecurity}
                            />
                        )}
                        {selectedTab === 'config' && (
                            <ConfigTab 
                                repositories={repositories}
                                repositoryId={repositoryId}
                                refreshRepositoryConfig={refreshRepositoryConfig}
                                configForm={configForm}
                                setConfigForm={setConfigForm}
                                configValidation={configValidation}
                                handleSaveConfig={handleSaveConfig}
                                ruleForm={ruleForm}
                                setRuleForm={setRuleForm}
                                handleTestRule={handleTestRule}
                                handleSaveRule={handleSaveRule}
                                ruleFeedback={ruleFeedback}
                                setRuleFeedback={setRuleFeedback}
                                configData={configData}
                            />
                        )}
                        {selectedTab === 'logs' && (
                            <LogsTab 
                                setLogs={setLogs}
                                logContainerRef={logContainerRef}
                                logs={logs}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
