const now = new Date().toISOString();

const snapshot = {
    overview: {
        openPRs: 12,
        blockingPRs: 3,
        avgReviewSeconds: 5400,
        slaComplianceRate: 91,
        avgHealthScore: 82
    },
    metricsOverview: {
        total_reviews: 48
    },
    repositories: [
        { id: 1, full_name: 'acme/platform' },
        { id: 2, full_name: 'acme/mobile-app' }
    ],
    reviewQueue: [
        { github_pr_id: 842, title: 'Refine Tailwind dashboard shell', is_blocking: true, repository: 'acme/platform', author: 'rheza', priority_score: 95, health_score: 78 },
        { github_pr_id: 839, title: 'Stabilize retry policy for webhook jobs', is_blocking: false, repository: 'acme/platform', author: 'mira', priority_score: 72, health_score: 88 }
    ],
    recentActivity: [
        { title: 'Auto-fix completed', description: 'SQL injection warning resolved in repository rule set.', created_at: now, status: 'success' },
        { title: 'Review queued', description: 'PR #842 promoted due to health score drop.', created_at: now, status: 'warn' }
    ],
    workload: [
        { label: 'Rheza', value: 84 },
        { label: 'Mira', value: 53 },
        { label: 'Nadia', value: 67 }
    ],
    configSummary: [
        { repository: 'acme/platform', mode: 'comment', interval: 600, autoMerge: true, threshold: 10 },
        { repository: 'acme/mobile-app', mode: 'review', interval: 900, autoMerge: false, threshold: 8 }
    ],
    trendData: [
        { bucket: '2026-03-01', avg_duration: 3800 },
        { bucket: '2026-03-02', avg_duration: 4600 },
        { bucket: '2026-03-03', avg_duration: 4200 },
        { bucket: '2026-03-04', avg_duration: 6100 },
        { bucket: '2026-03-05', avg_duration: 5100 },
        { bucket: '2026-03-06', avg_duration: 4700 }
    ],
    approvalByExecutor: [
        { executor_type: 'gemini', approval_rate: 91.2, total_reviews: 23 },
        { executor_type: 'claude', approval_rate: 86.4, total_reviews: 14 },
        { executor_type: 'human', approval_rate: 94.8, total_reviews: 11 }
    ],
    rejectionReasons: [
        { issue_type: 'security', count: 8 },
        { issue_type: 'tests', count: 5 },
        { issue_type: 'performance', count: 3 }
    ]
};

const prs = [
    { id: 1, github_pr_id: 842, title: 'Refine Tailwind dashboard shell', status: 'open', latest_outcome: 'approved', review_level: 'senior', repository: 'acme/platform', author: 'rheza', priority_score: 95, health_score: 78 },
    { id: 2, github_pr_id: 839, title: 'Stabilize retry policy for webhook jobs', status: 'open', latest_outcome: 'changes_requested', review_level: 'staff', repository: 'acme/platform', author: 'mira', priority_score: 72, health_score: 88 }
];

const prDetail = {
    pr: { ...prs[0], sla_hours: 4 },
    reviews: [
        { executor_type: 'gemini', outcome: 'approved', status: 'completed', duration_seconds: 3200, completed_at: now, started_at: now }
    ],
    comments: [
        { issue_type: 'security', severity: 'critical', message: 'Sanitize repository rule payload before persistence.', file_path: 'src/config-manager.js', line_number: 48, executor_type: 'gemini' }
    ],
    securityFindings: [
        { title: 'Potential injection risk', severity: 'critical', description: 'Interpolated string detected in query builder path.', file_path: 'src/config-manager.js', detected_at: now, repository: 'acme/platform', github_pr_id: 842 }
    ],
    autoFixAttempts: [
        { attempt_number: 1, status: 'success', issues_targeted: [1], started_at: now }
    ],
    testRuns: [
        { run_type: 'test-and-heal', status: 'passed', duration_seconds: 870, started_at: now }
    ]
};

const teamSecurity = {
    developers: [
        { id: 1, display_name: 'Rheza', role: 'Backend', is_available: true, unavailable_until: null, current_workload_score: 84 },
        { id: 2, display_name: 'Mira', role: 'Reviewer', is_available: false, unavailable_until: now, current_workload_score: 53 }
    ],
    recentAlerts: [
        { title: 'Queue surge', priority: 'high', message: 'Blocking PR count exceeded threshold.', created_at: now }
    ],
    securityFindings: [
        { title: 'Potential injection risk', severity: 'critical', description: 'Interpolated string detected in query builder path.', repository: 'acme/platform', github_pr_id: 842, file_path: 'src/config-manager.js', detected_at: now },
        { title: 'Missing timeout', severity: 'medium', description: 'Webhook retry client lacks request timeout.', repository: 'acme/mobile-app', github_pr_id: 839, file_path: 'src/webhook.js', detected_at: now }
    ]
};

const repositoryConfigPayload = {
    repository: { full_name: 'acme/platform', default_branch: 'main' },
    config: {
        reviewInterval: 600,
        reviewMode: 'comment',
        aiExecutor: 'gemini',
        autoMerge: true,
        severityThreshold: 10,
        autoMergeHealthThreshold: 60,
        logLevel: 'info',
        requiredChecks: ['tests', 'review']
    },
    rules: [
        { id: 1, rule_name: 'Detect SQL interpolation', rule_type: 'regex', severity: 'critical', pattern: 'SELECT .*\\$\\{', message: 'Avoid raw interpolation in SQL strings.' }
    ]
};

function createMockElectronAPI() {
    return {
        openExternal: async () => {},
        getRuntimeConfig: async () => ({ success: true, config: { wsUrl: '', wsUserId: 'playwright', wsToken: 'playwright' } }),
        getDashboardSnapshot: async () => ({ success: true, snapshot }),
        listPRs: async () => ({ success: true, prs }),
        getPRDetail: async () => ({ success: true, detail: prDetail }),
        getTeamSecurityData: async () => ({ success: true, data: teamSecurity }),
        getRepositoryConfigData: async () => ({ success: true, payload: repositoryConfigPayload }),
        setDeveloperAvailability: async () => ({ success: true }),
        deleteCustomRule: async () => ({ success: true }),
        startReview: async () => ({ success: true, message: 'started' }),
        executeNow: async () => ({ success: true, message: 'executed' }),
        stopReview: async () => ({ success: true, message: 'stopped' }),
        exportMetricsData: async () => ({ success: true, result: { fileName: 'metrics.csv', filePath: '/tmp/metrics.csv' } }),
        saveRepositoryConfigData: async () => ({ success: true }),
        testCustomRule: async () => ({ success: true, violations: [1] }),
        saveCustomRule: async () => ({ success: true, ruleId: 2 }),
        showNotification: async () => {},
        readContextFile: async () => ({ success: true, content: '' }),
        writeContextFile: async () => ({ success: true }),
        testAgent: async () => ({ success: true }),
        getHistory: async () => ({ success: true, history: [] }),
        getStats: async () => ({ success: true, stats: {} }),
        onLogOutput: () => {},
        onReviewStopped: () => {}
    };
}

module.exports = {
    createMockElectronAPI
};
