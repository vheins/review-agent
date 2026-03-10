const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('⚠ Another instance is already running. Exiting...');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // Show notification
            new Notification({
                title: 'Agentic Bunshin',
                body: 'Application is already running!'
            }).show();
        }
    });
}

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit',
            ignored: /node_modules|[\/\\]\./,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            }
        });
        console.log('✓ Hot reload enabled for renderer files');
    } catch (err) {
        console.log('⚠ electron-reload not found, install with: yarn add electron-reload');
    }
}

let mainWindow;
let reviewProcess = null;

async function loadRuntimeModules() {
    const dbPath = path.join(__dirname, '..', 'src', 'database.js');
    const configPath = path.join(__dirname, '..', 'src', 'config.js');
    const ruleEnginePath = path.join(__dirname, '..', 'src', 'rule-engine.js');
    const dataExporterPath = path.join(__dirname, '..', 'src', 'data-exporter.js');
    const metricsEnginePath = path.join(__dirname, '..', 'src', 'metrics-engine.js');
    const assignmentEnginePath = path.join(__dirname, '..', 'src', 'assignment-engine.js');

    const [
        databaseModule,
        configModule,
        ruleEngineModule,
        dataExporterModule,
        metricsEngineModule,
        assignmentEngineModule
    ] = await Promise.all([
        import(dbPath),
        import(configPath),
        import(ruleEnginePath),
        import(dataExporterPath),
        import(metricsEnginePath),
        import(assignmentEnginePath)
    ]);

    await databaseModule.dbManager.initialize();

    return {
        dbManager: databaseModule.dbManager,
        configManager: configModule.configManager,
        ruleEngine: ruleEngineModule.ruleEngine,
        dataExporter: dataExporterModule.dataExporter,
        metricsEngine: metricsEngineModule.metricsEngine,
        assignmentEngine: assignmentEngineModule.assignmentEngine
    };
}

function buildDateFilters(rangeDays) {
    if (!rangeDays || Number.isNaN(Number(rangeDays))) {
        return {};
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - Number(rangeDays) * 24 * 60 * 60 * 1000);

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    };
}

function parseJsonField(value, fallback = null) {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1120,
        minHeight: 700,
        backgroundColor: '#f3efe6',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (reviewProcess) {
        reviewProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.handle('start-review', async (event, config) => {
    if (reviewProcess) {
        return { success: false, message: 'Review already running' };
    }

    const args = ['src/index.js'];
    if (config.once) args.push('--once');
    if (config.dryRun) args.push('--dry-run');

    reviewProcess = spawn('node', args, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ...config.env }
    });

    reviewProcess.stdout.on('data', (data) => {
        mainWindow.webContents.send('log-output', {
            type: 'info',
            message: data.toString()
        });
    });

    reviewProcess.stderr.on('data', (data) => {
        mainWindow.webContents.send('log-output', {
            type: 'error',
            message: data.toString()
        });
    });

    reviewProcess.on('close', (code) => {
        reviewProcess = null;
        mainWindow.webContents.send('review-stopped', { code });
    });

    return { success: true, message: 'Review started' };
});

ipcMain.handle('stop-review', async () => {
    if (reviewProcess) {
        reviewProcess.kill();
        reviewProcess = null;
        return { success: true, message: 'Review stopped' };
    }
    return { success: false, message: 'No review running' };
});

ipcMain.handle('execute-now', async () => {
    if (reviewProcess) {
        // Send SIGUSR1 signal to trigger immediate execution
        reviewProcess.kill('SIGUSR1');
        return { success: true, message: 'Execute now signal sent' };
    }
    return { success: false, message: 'No review running' };
});

ipcMain.handle('get-config', async () => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf-8');

        const config = {};
        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        });

        return { success: true, config };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        const envPath = path.join(__dirname, '..', '.env');

        // Read existing .env file
        let existingConfig = {};
        if (fs.existsSync(envPath)) {
            const existingContent = fs.readFileSync(envPath, 'utf-8');
            existingContent.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key) {
                        existingConfig[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
        }

        // Merge with new config (new values override existing)
        const mergedConfig = { ...existingConfig, ...config };

        // Write merged config back
        const envContent = Object.entries(mergedConfig)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(envPath, envContent);
        return { success: true, message: 'Config saved' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
    new Notification({ title, body }).show();
    return { success: true };
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
    return { success: true };
});

ipcMain.handle('get-runtime-config', async () => {
    const port = process.env.API_PORT || '3000';
    return {
        success: true,
        config: {
            apiBaseUrl: `http://127.0.0.1:${port}/api`,
            wsUrl: `ws://127.0.0.1:${port}`,
            wsUserId: 'electron-dashboard',
            wsToken: process.env.DASHBOARD_SESSION_TOKEN || 'electron-dashboard-token'
        }
    };
});

ipcMain.handle('get-dashboard-snapshot', async (event, { rangeDays = 30 } = {}) => {
    try {
        const { dbManager, configManager, metricsEngine } = await loadRuntimeModules();
        const filters = buildDateFilters(rangeDays);

        const overview = dbManager.db.prepare(`
            SELECT
                SUM(CASE WHEN pr.status = 'open' THEN 1 ELSE 0 END) AS open_prs,
                SUM(CASE WHEN pr.is_blocking = 1 THEN 1 ELSE 0 END) AS blocking_prs,
                ROUND(AVG(rs.duration_seconds), 2) AS avg_review_seconds,
                ROUND(AVG(pr.health_score), 2) AS avg_health_score,
                SUM(
                    CASE
                        WHEN pr.status = 'open'
                         AND julianday('now') - julianday(pr.created_at) <= (repo.sla_hours / 24.0)
                        THEN 1
                        ELSE 0
                    END
                ) AS within_sla,
                SUM(CASE WHEN pr.status = 'open' THEN 1 ELSE 0 END) AS total_open_for_sla
            FROM pull_requests pr
            JOIN repositories repo ON repo.id = pr.repository_id
            LEFT JOIN review_sessions rs ON rs.pr_id = pr.id
            WHERE 1 = 1
              ${filters.startDate ? 'AND pr.created_at >= @startDate' : ''}
              ${filters.endDate ? 'AND pr.created_at <= @endDate' : ''}
        `).get(filters);

        const reviewQueue = dbManager.db.prepare(`
            SELECT
                pr.id,
                pr.github_pr_id,
                pr.title,
                pr.status,
                pr.priority_score,
                pr.health_score,
                pr.is_blocking,
                pr.created_at,
                repo.full_name AS repository,
                COALESCE(dev.display_name, dev.github_username, 'Unknown') AS author
            FROM pull_requests pr
            JOIN repositories repo ON repo.id = pr.repository_id
            LEFT JOIN developers dev ON dev.id = pr.author_id
            WHERE pr.status = 'open'
            ORDER BY pr.priority_score DESC, pr.created_at ASC
            LIMIT 8
        `).all();

        const teamWorkload = dbManager.db.prepare(`
            SELECT
                id,
                github_username,
                COALESCE(display_name, github_username) AS display_name,
                current_workload_score,
                is_available,
                unavailable_until
            FROM developers
            ORDER BY current_workload_score DESC, github_username ASC
            LIMIT 8
        `).all();

        const recentActivity = dbManager.db.prepare(`
            SELECT
                'review' AS source,
                rs.id AS item_id,
                rs.outcome AS status,
                rs.completed_at AS occurred_at,
                pr.title,
                pr.github_pr_id,
                repo.full_name AS repository
            FROM review_sessions rs
            JOIN pull_requests pr ON pr.id = rs.pr_id
            JOIN repositories repo ON repo.id = pr.repository_id
            WHERE rs.completed_at IS NOT NULL
            UNION ALL
            SELECT
                'audit' AS source,
                at.id AS item_id,
                at.action_type AS status,
                at.timestamp AS occurred_at,
                at.resource_type || ' #' || at.resource_id AS title,
                NULL AS github_pr_id,
                at.actor_id AS repository
            FROM audit_trail at
            ORDER BY occurred_at DESC
            LIMIT 12
        `).all();

        const repositories = dbManager.db.prepare(`
            SELECT id, full_name, default_branch, sla_hours
            FROM repositories
            ORDER BY full_name ASC
        `).all();

        const metricsOverview = await metricsEngine.calculateMetrics(filters);
        const trendData = await metricsEngine.getMetricsByTimeBucket('day', filters);
        const approvalByExecutor = dbManager.db.prepare(`
            SELECT
                executor_type,
                COUNT(*) AS total_reviews,
                SUM(CASE WHEN outcome = 'approved' THEN 1 ELSE 0 END) AS approved_reviews
            FROM review_sessions
            WHERE completed_at IS NOT NULL
              ${filters.startDate ? 'AND completed_at >= @startDate' : ''}
              ${filters.endDate ? 'AND completed_at <= @endDate' : ''}
            GROUP BY executor_type
            ORDER BY total_reviews DESC, executor_type ASC
        `).all(filters).map((row) => ({
            ...row,
            approval_rate: row.total_reviews > 0
                ? Number(((row.approved_reviews / row.total_reviews) * 100).toFixed(1))
                : 0
        }));

        const rejectionReasons = dbManager.db.prepare(`
            SELECT
                rc.issue_type,
                COUNT(*) AS count
            FROM review_comments rc
            JOIN review_sessions rs ON rs.id = rc.review_session_id
            WHERE rs.completed_at IS NOT NULL
              ${filters.startDate ? 'AND rs.completed_at >= @startDate' : ''}
              ${filters.endDate ? 'AND rs.completed_at <= @endDate' : ''}
            GROUP BY rc.issue_type
            ORDER BY count DESC, rc.issue_type ASC
            LIMIT 8
        `).all(filters);

        const securitySummary = dbManager.db.prepare(`
            SELECT
                severity,
                COUNT(*) AS count
            FROM security_findings
            GROUP BY severity
            ORDER BY CASE severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                ELSE 4
            END
        `).all();

        const configSummaries = await Promise.all(repositories.map(async (repository) => {
            const repoConfig = await configManager.getRepoConfig(repository.id);
            return {
                repositoryId: repository.id,
                repository: repository.full_name,
                reviewInterval: repoConfig.reviewInterval,
                autoMerge: repoConfig.autoMerge,
                aiExecutor: repoConfig.aiExecutor,
                slaHours: repository.sla_hours
            };
        }));

        return {
            success: true,
            snapshot: {
                rangeDays: Number(rangeDays),
                overview: {
                    openPRs: overview?.open_prs ?? 0,
                    blockingPRs: overview?.blocking_prs ?? 0,
                    avgReviewSeconds: overview?.avg_review_seconds ?? 0,
                    avgHealthScore: overview?.avg_health_score ?? 0,
                    slaComplianceRate: overview?.total_open_for_sla
                        ? Number(((overview.within_sla / overview.total_open_for_sla) * 100).toFixed(1))
                        : 100
                },
                metricsOverview: metricsOverview ?? {},
                reviewQueue,
                teamWorkload,
                recentActivity,
                repositories,
                trendData,
                approvalByExecutor,
                rejectionReasons,
                securitySummary,
                configSummaries
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('list-prs', async (event, { status = '', repositoryId = '', authorId = '', search = '' } = {}) => {
    try {
        const { dbManager } = await loadRuntimeModules();
        let query = `
            SELECT
                pr.id,
                pr.github_pr_id,
                pr.author_id,
                pr.title,
                pr.description,
                pr.status,
                pr.priority_score,
                pr.health_score,
                pr.created_at,
                pr.updated_at,
                pr.review_level,
                repo.full_name AS repository,
                COALESCE(dev.display_name, dev.github_username, 'Unknown') AS author,
                (
                    SELECT outcome
                    FROM review_sessions rs
                    WHERE rs.pr_id = pr.id
                    ORDER BY COALESCE(rs.completed_at, rs.started_at) DESC
                    LIMIT 1
                ) AS latest_outcome
            FROM pull_requests pr
            JOIN repositories repo ON repo.id = pr.repository_id
            LEFT JOIN developers dev ON dev.id = pr.author_id
            WHERE 1 = 1
        `;
            const params = {};

        if (status) {
            query += ' AND pr.status = @status';
            params.status = status;
        }

        if (repositoryId) {
            query += ' AND pr.repository_id = @repositoryId';
            params.repositoryId = Number(repositoryId);
        }

        if (search) {
            query += ' AND (pr.title LIKE @search OR repo.full_name LIKE @search OR dev.github_username LIKE @search)';
            params.search = `%${search}%`;
        }

        if (authorId) {
            query += ' AND pr.author_id = @authorId';
            params.authorId = Number(authorId);
        }

        query += ' ORDER BY pr.priority_score DESC, pr.updated_at DESC LIMIT 100';

        return { success: true, prs: dbManager.db.prepare(query).all(params) };
    } catch (error) {
        return { success: false, error: error.message, prs: [] };
    }
});

ipcMain.handle('get-pr-detail', async (event, prId) => {
    try {
        const { dbManager } = await loadRuntimeModules();
        const pr = dbManager.db.prepare(`
            SELECT
                pr.*,
                repo.full_name AS repository,
                repo.sla_hours,
                COALESCE(dev.display_name, dev.github_username, 'Unknown') AS author
            FROM pull_requests pr
            JOIN repositories repo ON repo.id = pr.repository_id
            LEFT JOIN developers dev ON dev.id = pr.author_id
            WHERE pr.id = ?
        `).get(prId);

        if (!pr) {
            return { success: false, error: 'PR not found' };
        }

        const reviews = dbManager.db.prepare(`
            SELECT *
            FROM review_sessions
            WHERE pr_id = ?
            ORDER BY COALESCE(completed_at, started_at) DESC
        `).all(prId);

        const comments = dbManager.db.prepare(`
            SELECT rc.*, rs.executor_type
            FROM review_comments rc
            JOIN review_sessions rs ON rs.id = rc.review_session_id
            WHERE rs.pr_id = ?
            ORDER BY rc.created_at DESC
        `).all(prId);

        const securityFindings = dbManager.db.prepare(`
            SELECT *
            FROM security_findings
            WHERE pr_id = ?
            ORDER BY detected_at DESC
        `).all(prId);

        const autoFixAttempts = dbManager.db.prepare(`
            SELECT *
            FROM auto_fix_attempts
            WHERE pr_id = ?
            ORDER BY started_at DESC
        `).all(prId).map((attempt) => ({
            ...attempt,
            issues_targeted: parseJsonField(attempt.issues_targeted, []),
            fixes_applied: parseJsonField(attempt.fixes_applied, [])
        }));

        const testRuns = dbManager.db.prepare(`
            SELECT *
            FROM test_runs
            WHERE pr_id = ?
            ORDER BY started_at DESC
        `).all(prId).map((run) => ({
            ...run,
            test_results: parseJsonField(run.test_results, {}),
            failures_detected: parseJsonField(run.failures_detected, [])
        }));

        return {
            success: true,
            detail: {
                pr,
                reviews,
                comments,
                securityFindings,
                autoFixAttempts,
                testRuns
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-team-security-data', async () => {
    try {
        const { dbManager } = await loadRuntimeModules();
        const developers = dbManager.db.prepare(`
            SELECT
                id,
                github_username,
                COALESCE(display_name, github_username) AS display_name,
                role,
                is_available,
                unavailable_until,
                current_workload_score
            FROM developers
            ORDER BY current_workload_score DESC, github_username ASC
        `).all();

        const recentAlerts = dbManager.db.prepare(`
            SELECT
                id,
                title,
                message,
                priority,
                created_at
            FROM notifications
            ORDER BY created_at DESC
            LIMIT 12
        `).all();

        const securityFindings = dbManager.db.prepare(`
            SELECT
                sf.*,
                pr.github_pr_id,
                repo.full_name AS repository
            FROM security_findings sf
            JOIN pull_requests pr ON pr.id = sf.pr_id
            JOIN repositories repo ON repo.id = pr.repository_id
            ORDER BY sf.detected_at DESC
            LIMIT 20
        `).all();

        return {
            success: true,
            data: {
                developers,
                recentAlerts,
                securityFindings
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-developer-availability', async (event, { developerId, isAvailable, unavailableUntil }) => {
    try {
        const { assignmentEngine } = await loadRuntimeModules();
        await assignmentEngine.setAvailability(developerId, isAvailable, unavailableUntil || null);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-repository-config-data', async (event, repositoryId) => {
    try {
        const { dbManager, configManager, ruleEngine } = await loadRuntimeModules();
        const repository = dbManager.db.prepare(`
            SELECT id, full_name, default_branch, sla_hours
            FROM repositories
            WHERE id = ?
        `).get(repositoryId);

        if (!repository) {
            return { success: false, error: 'Repository not found' };
        }

        const config = await configManager.getRepoConfig(repositoryId);
        const rules = await ruleEngine.loadRules(repositoryId);

        return {
            success: true,
            payload: {
                repository,
                config,
                rules
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-repository-config-data', async (event, { repositoryId, config }) => {
    try {
        const { configManager } = await loadRuntimeModules();
        await configManager.saveRepoConfig(repositoryId, config, 'electron-dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-custom-rule', async (event, { repositoryId, rule }) => {
    try {
        const { ruleEngine, dbManager } = await loadRuntimeModules();
        let ruleId = rule.id ? Number(rule.id) : null;

        if (ruleId) {
            ruleEngine.validateRule(rule);
            dbManager.db.prepare(`
                UPDATE custom_rules
                SET
                    rule_name = ?,
                    rule_type = ?,
                    pattern = ?,
                    severity = ?,
                    message = ?,
                    auto_fixable = ?,
                    auto_fix_template = ?,
                    enabled = ?,
                    branch_patterns = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND repository_id = ?
            `).run(
                rule.rule_name,
                rule.rule_type,
                rule.pattern,
                rule.severity,
                rule.message,
                rule.auto_fixable ? 1 : 0,
                rule.auto_fix_template ?? null,
                rule.enabled !== false ? 1 : 0,
                Array.isArray(rule.branch_patterns) ? JSON.stringify(rule.branch_patterns) : (rule.branch_patterns ?? null),
                ruleId,
                repositoryId
            );
        } else {
            ruleId = await ruleEngine.saveRule(repositoryId, rule);
        }

        return { success: true, ruleId };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-custom-rule', async (event, ruleId) => {
    try {
        const { dbManager } = await loadRuntimeModules();
        dbManager.db.prepare('DELETE FROM custom_rules WHERE id = ?').run(ruleId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('test-custom-rule', async (event, { rule, sampleCode }) => {
    try {
        const { ruleEngine } = await loadRuntimeModules();
        const violations = await ruleEngine.testRule(rule, sampleCode);
        return { success: true, violations };
    } catch (error) {
        return { success: false, error: error.message, violations: [] };
    }
});

ipcMain.handle('export-metrics-data', async (event, { filters = {}, format = 'csv' } = {}) => {
    try {
        const { dataExporter } = await loadRuntimeModules();
        const result = await dataExporter.exportMetrics(filters, format, 'electron-dashboard');
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});


ipcMain.handle('read-context-file', async (event, fileName) => {
    try {
        let filePath;
        if (fileName === 'agents') {
            filePath = path.join(__dirname, '..', 'agents.md');
        } else {
            filePath = path.join(__dirname, '..', 'context', `${fileName}.md`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content, filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('write-context-file', async (event, { fileName, content }) => {
    try {
        let filePath;
        if (fileName === 'agents') {
            filePath = path.join(__dirname, '..', 'agents.md');
        } else {
            filePath = path.join(__dirname, '..', 'context', `${fileName}.md`);
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, message: 'File saved successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('test-agent', async (event) => {
    try {
        const delegatePath = path.join(__dirname, '..', 'src', 'delegate.js');
        const { executeAIReview } = await import(delegatePath);

        const repoDir = path.join(__dirname, '..');
        const testPrompt = 'Haloo';

        const output = await executeAIReview(testPrompt, repoDir, 'review');

        return { success: true, output };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-history', async (event, limit = 50) => {
    try {
        const { dbManager } = await loadRuntimeModules();
        const reviews = dbManager.db.prepare(`
            SELECT
                rs.id,
                rs.outcome AS decision,
                rs.quality_score AS severity_score,
                rs.completed_at AS reviewed_at,
                pr.github_pr_id AS pr_number,
                pr.title AS pr_title,
                repo.full_name AS repository,
                'https://github.com/' || repo.full_name || '/pull/' || pr.github_pr_id AS pr_url
            FROM review_sessions rs
            JOIN pull_requests pr ON pr.id = rs.pr_id
            JOIN repositories repo ON repo.id = pr.repository_id
            WHERE rs.completed_at IS NOT NULL
            ORDER BY rs.completed_at DESC
            LIMIT ?
        `).all(limit);
        return { success: true, reviews };
    } catch (error) {
        return { success: false, error: error.message, reviews: [] };
    }
});

ipcMain.handle('get-stats', async (event) => {
    try {
        const { dbManager } = await loadRuntimeModules();
        const stats = dbManager.db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN rs.outcome = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN rs.outcome IN ('rejected', 'needs_changes') THEN 1 ELSE 0 END) AS rejected
            FROM review_sessions rs
        `).get();
        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message, stats: { total: 0, approved: 0, rejected: 0 } };
    }
});
