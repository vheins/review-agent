const state = {
    running: false,
    selectedTab: 'overview',
    rangeDays: 30,
    runtimeConfig: null,
    repositories: [],
    prs: [],
    selectedPrId: null,
    ws: null,
    wsReconnectTimer: null,
    wsReconnectDelay: 1000,
    latestSnapshot: null,
    teamSecurity: null,
    configPayload: null,
    logCount: 0
};

const elements = {
    navTabs: document.getElementById('navTabs'),
    toolbarTitle: document.getElementById('toolbarTitle'),
    globalRange: document.getElementById('globalRange'),
    refreshAllBtn: document.getElementById('refreshAllBtn'),
    startBtn: document.getElementById('startBtn'),
    startOnceBtn: document.getElementById('startOnceBtn'),
    executeNowBtn: document.getElementById('executeNowBtn'),
    stopBtn: document.getElementById('stopBtn'),
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.querySelector('#statusBadge .status-text'),
    wsStatus: document.getElementById('wsStatus'),
    apiStatus: document.getElementById('apiStatus'),
    overviewMetrics: document.getElementById('overviewMetrics'),
    reviewQueue: document.getElementById('reviewQueue'),
    activityFeed: document.getElementById('activityFeed'),
    overviewWorkload: document.getElementById('overviewWorkload'),
    configSummaryList: document.getElementById('configSummaryList'),
    prStatusFilter: document.getElementById('prStatusFilter'),
    prRepositoryFilter: document.getElementById('prRepositoryFilter'),
    prAuthorFilter: document.getElementById('prAuthorFilter'),
    prSearchInput: document.getElementById('prSearchInput'),
    prList: document.getElementById('prList'),
    prDetailTitle: document.getElementById('prDetailTitle'),
    prDetail: document.getElementById('prDetail'),
    trendChart: document.getElementById('trendChart'),
    executorChart: document.getElementById('executorChart'),
    rejectionChart: document.getElementById('rejectionChart'),
    exportMetricsBtn: document.getElementById('exportMetricsBtn'),
    exportStatus: document.getElementById('exportStatus'),
    teamWorkload: document.getElementById('teamWorkload'),
    teamTableBody: document.getElementById('teamTableBody'),
    alertsList: document.getElementById('alertsList'),
    securityMetrics: document.getElementById('securityMetrics'),
    securityFindingsList: document.getElementById('securityFindingsList'),
    configRepositorySelect: document.getElementById('configRepositorySelect'),
    configForm: document.getElementById('configForm'),
    configValidation: document.getElementById('configValidation'),
    ruleForm: document.getElementById('ruleForm'),
    ruleSampleCode: document.getElementById('ruleSampleCode'),
    testRuleBtn: document.getElementById('testRuleBtn'),
    resetRuleBtn: document.getElementById('resetRuleBtn'),
    ruleTestOutput: document.getElementById('ruleTestOutput'),
    rulesList: document.getElementById('rulesList'),
    logsContainer: document.getElementById('logsContainer'),
    clearLogsBtn: document.getElementById('clearLogsBtn')
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDuration(seconds) {
    if (!seconds) {
        return '0m';
    }

    const totalSeconds = Math.round(Number(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function formatRelativeTime(value) {
    if (!value) {
        return 'Unknown';
    }

    const diffMs = new Date(value).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);

    if (Math.abs(diffMinutes) < 60) {
        return `${Math.abs(diffMinutes)}m ${diffMinutes < 0 ? 'ago' : 'from now'}`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
        return `${Math.abs(diffHours)}h ${diffHours < 0 ? 'ago' : 'from now'}`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `${Math.abs(diffDays)}d ${diffDays < 0 ? 'ago' : 'from now'}`;
}

function setAPIStatus(text, success = true) {
    elements.apiStatus.textContent = text;
    elements.apiStatus.style.color = success ? 'var(--success)' : 'var(--danger)';
}

function updateRunningState(running) {
    state.running = running;
    elements.statusBadge.classList.toggle('running', running);
    elements.statusText.textContent = running ? 'Running' : 'Stopped';
    elements.startBtn.disabled = running;
    elements.startOnceBtn.disabled = running;
    elements.executeNowBtn.disabled = !running;
    elements.stopBtn.disabled = !running;
}

function addLog(type, message) {
    if (elements.logsContainer.querySelector('.empty-state')) {
        elements.logsContainer.innerHTML = '';
    }

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message.trim()}`;
    elements.logsContainer.prepend(entry);
    state.logCount += 1;

    while (elements.logsContainer.children.length > 200) {
        elements.logsContainer.removeChild(elements.logsContainer.lastChild);
    }
}

function openExternalLink(url) {
    if (!url) {
        return;
    }

    window.electronAPI.openExternal(url);
}

function renderMetricCards(snapshot) {
    const cards = [
        {
            label: 'Open PRs',
            value: snapshot.overview.openPRs ?? 0,
            delta: `${snapshot.overview.blockingPRs ?? 0} blocking right now`
        },
        {
            label: 'Avg Review Time',
            value: formatDuration(snapshot.overview.avgReviewSeconds),
            delta: `${snapshot.metricsOverview.total_reviews ?? 0} completed reviews`
        },
        {
            label: 'SLA Compliance',
            value: `${snapshot.overview.slaComplianceRate ?? 0}%`,
            delta: `${state.rangeDays}-day moving window`
        },
        {
            label: 'Health Score',
            value: Math.round(snapshot.overview.avgHealthScore ?? 0),
            delta: 'Average PR health across tracked repos'
        }
    ];

    elements.overviewMetrics.innerHTML = cards.map((card) => `
        <article class="metric-card">
          <p class="eyebrow">${escapeHtml(card.label)}</p>
          <div class="value">${escapeHtml(card.value)}</div>
          <div class="delta">${escapeHtml(card.delta)}</div>
        </article>
    `).join('');
}

function renderReviewQueue(snapshot) {
    if (!snapshot.reviewQueue.length) {
        elements.reviewQueue.innerHTML = '<div class="empty-state">No open pull requests in the queue.</div>';
        return;
    }

    elements.reviewQueue.innerHTML = snapshot.reviewQueue.map((pr) => `
        <article class="list-item">
          <div class="card-row">
            <strong>#${escapeHtml(pr.github_pr_id)}</strong>
            <span class="badge ${pr.is_blocking ? 'danger' : 'warn'}">${pr.is_blocking ? 'Blocking' : 'Queued'}</span>
          </div>
          <div>${escapeHtml(pr.title)}</div>
          <div class="meta-row">
            <span>${escapeHtml(pr.repository)}</span>
            <span>${escapeHtml(pr.author)}</span>
            <span>Priority ${escapeHtml(pr.priority_score ?? 0)}</span>
            <span>Health ${escapeHtml(pr.health_score ?? 'n/a')}</span>
          </div>
        </article>
    `).join('');
}

function renderActivityFeed(snapshot) {
    if (!snapshot.recentActivity.length) {
        elements.activityFeed.innerHTML = '<div class="empty-state">No recent activity yet.</div>';
        return;
    }

    elements.activityFeed.innerHTML = snapshot.recentActivity.map((activity) => `
        <article class="list-item">
          <div class="card-row">
            <strong>${escapeHtml(activity.source === 'review' ? `PR #${activity.github_pr_id}` : activity.status)}</strong>
            <span class="badge">${escapeHtml(activity.source)}</span>
          </div>
          <div>${escapeHtml(activity.title)}</div>
          <div class="meta-row">
            <span>${escapeHtml(activity.repository ?? '')}</span>
            <span>${escapeHtml(formatRelativeTime(activity.occurred_at))}</span>
          </div>
        </article>
    `).join('');
}

function renderBarList(target, items, formatter) {
    if (!items.length) {
        target.innerHTML = '<div class="empty-state">No data available.</div>';
        return;
    }

    const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1);
    target.innerHTML = items.map((item) => {
        const width = Math.max(8, Math.round(((Number(item.value) || 0) / maxValue) * 100));
        return `
            <div class="bar-item">
              <div class="card-row">
                <strong>${escapeHtml(item.label)}</strong>
                <span class="meta-row">${escapeHtml(formatter(item))}</span>
              </div>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            </div>
        `;
    }).join('');
}

function renderOverviewWorkload(snapshot) {
    renderBarList(
        elements.overviewWorkload,
        snapshot.teamWorkload.map((developer) => ({
            label: developer.display_name,
            value: developer.current_workload_score ?? 0,
            availability: developer.is_available
        })),
        (item) => `${item.value.toFixed?.(1) ?? item.value} pts`
    );
}

function renderConfigSummary(snapshot) {
    if (!snapshot.configSummaries.length) {
        elements.configSummaryList.innerHTML = '<div class="empty-state">No repositories registered.</div>';
        return;
    }

    elements.configSummaryList.innerHTML = snapshot.configSummaries.map((config) => `
        <article class="list-item">
          <div class="card-row">
            <strong>${escapeHtml(config.repository)}</strong>
            <span class="badge ${config.autoMerge ? 'success' : 'warn'}">${config.autoMerge ? 'Auto Merge On' : 'Manual Merge'}</span>
          </div>
          <div class="meta-row">
            <span>Executor ${escapeHtml(config.aiExecutor)}</span>
            <span>Interval ${escapeHtml(config.reviewInterval)}s</span>
            <span>SLA ${escapeHtml(config.slaHours)}h</span>
          </div>
        </article>
    `).join('');
}

function renderRepositoryOptions(repositories, prs = []) {
    const options = repositories.map((repo) => `
        <option value="${escapeHtml(repo.id)}">${escapeHtml(repo.full_name)}</option>
    `).join('');

    elements.prRepositoryFilter.innerHTML = '<option value="">All Repositories</option>' + options;
    elements.configRepositorySelect.innerHTML = options;

    const authors = [...new Map(
        prs.map((pr) => [String(pr.author_id ?? pr.author), {
            id: pr.author_id ?? '',
            name: pr.author
        }])
    ).values()];

    elements.prAuthorFilter.innerHTML = '<option value="">All Authors</option>' + authors.map((author) => `
        <option value="${escapeHtml(author.id)}">${escapeHtml(author.name)}</option>
    `).join('');
}

function renderPRList() {
    if (!state.prs.length) {
        elements.prList.innerHTML = '<div class="empty-state">No pull requests match the current filters.</div>';
        return;
    }

    elements.prList.innerHTML = state.prs.map((pr) => `
        <article class="pr-card ${state.selectedPrId === pr.id ? 'active' : ''}" data-pr-id="${escapeHtml(pr.id)}">
          <div class="card-row">
            <strong>#${escapeHtml(pr.github_pr_id)} ${escapeHtml(pr.title)}</strong>
          </div>
          <div class="badge-row">
            <span class="badge">${escapeHtml(pr.status)}</span>
            <span class="badge ${pr.latest_outcome === 'approved' ? 'success' : pr.latest_outcome ? 'warn' : ''}">${escapeHtml(pr.latest_outcome ?? 'pending')}</span>
            <span class="badge">${escapeHtml(pr.review_level ?? 'unassigned')}</span>
          </div>
          <div class="meta-row">
            <span>${escapeHtml(pr.repository)}</span>
            <span>${escapeHtml(pr.author)}</span>
            <span>Priority ${escapeHtml(pr.priority_score ?? 0)}</span>
            <span>Health ${escapeHtml(pr.health_score ?? 'n/a')}</span>
          </div>
        </article>
    `).join('');

    elements.prList.querySelectorAll('[data-pr-id]').forEach((card) => {
        card.addEventListener('click', async () => {
            state.selectedPrId = Number(card.dataset.prId);
            renderPRList();
            await loadPRDetail(state.selectedPrId);
        });
    });
}

function renderPRDetail(detail) {
    const { pr, reviews, comments, securityFindings, autoFixAttempts, testRuns } = detail;
    elements.prDetailTitle.textContent = `#${pr.github_pr_id} ${pr.title}`;

    const reviewBlocks = reviews.length
        ? reviews.map((review) => `
            <article class="list-item">
              <div class="card-row">
                <strong>${escapeHtml(review.executor_type)}</strong>
                <span class="badge ${review.outcome === 'approved' ? 'success' : review.outcome ? 'warn' : ''}">${escapeHtml(review.outcome ?? review.status)}</span>
              </div>
              <div class="meta-row">
                <span>Duration ${escapeHtml(formatDuration(review.duration_seconds))}</span>
                <span>${escapeHtml(formatRelativeTime(review.completed_at ?? review.started_at))}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No review history recorded.</div>';

    const commentBlocks = comments.length
        ? comments.slice(0, 8).map((comment) => `
            <article class="finding-card">
              <div class="card-row">
                <strong>${escapeHtml(comment.issue_type)}</strong>
                <span class="badge ${comment.severity === 'critical' || comment.severity === 'error' ? 'danger' : 'warn'}">${escapeHtml(comment.severity)}</span>
              </div>
              <div>${escapeHtml(comment.message)}</div>
              <div class="meta-row">
                <span>${escapeHtml(comment.file_path)}${comment.line_number ? `:${comment.line_number}` : ''}</span>
                <span>${escapeHtml(comment.executor_type)}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No comments stored for this PR.</div>';

    const autoFixBlock = autoFixAttempts.length
        ? autoFixAttempts.map((attempt) => `
            <article class="list-item">
              <div class="card-row">
                <strong>Attempt ${escapeHtml(attempt.attempt_number)}</strong>
                <span class="badge ${attempt.status === 'success' ? 'success' : 'warn'}">${escapeHtml(attempt.status)}</span>
              </div>
              <div class="meta-row">
                <span>${escapeHtml((attempt.issues_targeted || []).length)} issues</span>
                <span>${escapeHtml(formatRelativeTime(attempt.started_at))}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No auto-fix attempts recorded.</div>';

    const testRunBlock = testRuns.length
        ? testRuns.map((run) => `
            <article class="list-item">
              <div class="card-row">
                <strong>${escapeHtml(run.run_type)}</strong>
                <span class="badge ${run.status === 'passed' ? 'success' : 'warn'}">${escapeHtml(run.status)}</span>
              </div>
              <div class="meta-row">
                <span>${escapeHtml(formatDuration(run.duration_seconds))}</span>
                <span>${escapeHtml(formatRelativeTime(run.started_at))}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No test-and-heal runs recorded.</div>';

    const securityBlock = securityFindings.length
        ? securityFindings.map((finding) => `
            <article class="finding-card">
              <div class="card-row">
                <strong>${escapeHtml(finding.title)}</strong>
                <span class="badge ${finding.severity === 'critical' ? 'danger' : 'warn'}">${escapeHtml(finding.severity)}</span>
              </div>
              <div>${escapeHtml(finding.description)}</div>
              <div class="meta-row">
                <span>${escapeHtml(finding.file_path ?? 'repository scan')}</span>
                <span>${escapeHtml(formatRelativeTime(finding.detected_at))}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No security findings stored.</div>';

    elements.prDetail.innerHTML = `
        <section class="list-item">
          <div class="card-row">
            <strong>${escapeHtml(pr.repository)}</strong>
            <span class="badge">${escapeHtml(pr.status)}</span>
            <span class="badge">${escapeHtml(pr.review_level ?? 'unassigned')}</span>
          </div>
          <div class="meta-row">
            <span>Author ${escapeHtml(pr.author)}</span>
            <span>Priority ${escapeHtml(pr.priority_score ?? 0)}</span>
            <span>Health ${escapeHtml(pr.health_score ?? 'n/a')}</span>
            <span>SLA ${escapeHtml(pr.sla_hours)}h</span>
          </div>
        </section>
        <section class="panel-subsection">
          <h4>Review History</h4>
          ${reviewBlocks}
        </section>
        <section class="panel-subsection">
          <h4>Review Comments</h4>
          ${commentBlocks}
        </section>
        <section class="panel-subsection">
          <h4>Auto-fix Attempts</h4>
          ${autoFixBlock}
        </section>
        <section class="panel-subsection">
          <h4>Test & Heal</h4>
          ${testRunBlock}
        </section>
        <section class="panel-subsection">
          <h4>Security Findings</h4>
          ${securityBlock}
        </section>
    `;
}

function renderMetrics(snapshot) {
    if (!snapshot.trendData.length) {
        elements.trendChart.innerHTML = '<div class="empty-state">No review trend data yet.</div>';
    } else {
        const maxValue = Math.max(...snapshot.trendData.map((point) => Number(point.avg_duration) || 0), 1);
        elements.trendChart.innerHTML = snapshot.trendData.map((point) => {
            const height = Math.max(16, Math.round(((Number(point.avg_duration) || 0) / maxValue) * 160));
            const label = point.bucket.slice(5);
            return `
                <div class="spark-bar" style="height:${height}px" title="${escapeHtml(point.bucket)}: ${escapeHtml(formatDuration(point.avg_duration))}">
                  <span class="spark-label">${escapeHtml(label)}</span>
                </div>
            `;
        }).join('');
    }

    renderBarList(
        elements.executorChart,
        snapshot.approvalByExecutor.map((item) => ({
            label: item.executor_type,
            value: item.approval_rate,
            total_reviews: item.total_reviews
        })),
        (item) => `${Number(item.value).toFixed(1)}% approval`
    );

    renderBarList(
        elements.rejectionChart,
        snapshot.rejectionReasons.map((item) => ({
            label: item.issue_type,
            value: item.count
        })),
        (item) => `${item.value} comments`
    );
}

function renderTeamSecurity() {
    const data = state.teamSecurity;
    if (!data) {
        return;
    }

    renderBarList(
        elements.teamWorkload,
        data.developers.map((developer) => ({
            label: developer.display_name,
            value: developer.current_workload_score ?? 0
        })),
        (item) => `${Number(item.value).toFixed(1)} pts`
    );

    elements.teamTableBody.innerHTML = data.developers.length
        ? data.developers.map((developer) => `
            <tr>
              <td>${escapeHtml(developer.display_name)}</td>
              <td>${escapeHtml(developer.role)}</td>
              <td>${developer.is_available ? 'Available' : 'Unavailable'}</td>
              <td>${escapeHtml(developer.unavailable_until ? new Date(developer.unavailable_until).toLocaleString() : 'Open-ended')}</td>
              <td>
                <button class="btn btn-ghost" data-availability-id="${escapeHtml(developer.id)}" data-next-state="${developer.is_available ? '0' : '1'}">
                  ${developer.is_available ? 'Mark Away' : 'Restore'}
                </button>
              </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">No developers found.</td></tr>';

    elements.teamTableBody.querySelectorAll('[data-availability-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            const developerId = Number(button.dataset.availabilityId);
            const isAvailable = button.dataset.nextState === '1';
            const unavailableUntil = isAvailable
                ? null
                : new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

            const result = await window.electronAPI.setDeveloperAvailability({
                developerId,
                isAvailable,
                unavailableUntil
            });

            if (result.success) {
                await loadTeamSecurity();
                await refreshSnapshot();
            } else {
                addLog('error', result.error);
            }
        });
    });

    elements.alertsList.innerHTML = data.recentAlerts.length
        ? data.recentAlerts.map((alert) => `
            <article class="alert-card">
              <div class="card-row">
                <strong>${escapeHtml(alert.title)}</strong>
                <span class="badge ${alert.priority === 'urgent' || alert.priority === 'high' ? 'danger' : 'warn'}">${escapeHtml(alert.priority)}</span>
              </div>
              <div>${escapeHtml(alert.message)}</div>
              <div class="meta-row">${escapeHtml(formatRelativeTime(alert.created_at))}</div>
            </article>
        `).join('')
        : '<div class="empty-state">No recent notifications.</div>';

    const counts = ['critical', 'high', 'medium', 'low'].map((severity) => ({
        label: severity,
        value: data.securityFindings.filter((finding) => finding.severity === severity).length
    }));

    elements.securityMetrics.innerHTML = counts.map((metric) => `
        <article class="metric-card">
          <p class="eyebrow">${escapeHtml(metric.label)}</p>
          <div class="value">${escapeHtml(metric.value)}</div>
          <div class="delta">Recent findings by severity</div>
        </article>
    `).join('');

    elements.securityFindingsList.innerHTML = data.securityFindings.length
        ? data.securityFindings.map((finding) => `
            <article class="finding-card">
              <div class="card-row">
                <strong>${escapeHtml(finding.title)}</strong>
                <span class="badge ${finding.severity === 'critical' ? 'danger' : 'warn'}">${escapeHtml(finding.severity)}</span>
              </div>
              <div>${escapeHtml(finding.description)}</div>
              <div class="meta-row">
                <span>${escapeHtml(finding.repository)} / PR #${escapeHtml(finding.github_pr_id)}</span>
                <span>${escapeHtml(finding.file_path ?? 'scan')}</span>
                <span>${escapeHtml(formatRelativeTime(finding.detected_at))}</span>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No security findings available.</div>';
}

function validateConfigPayload(payload) {
    const reviewInterval = Number(payload.reviewInterval);
    const severityThreshold = Number(payload.severityThreshold);

    if (!Number.isFinite(reviewInterval) || reviewInterval < 60) {
        return 'Review interval must be at least 60 seconds.';
    }

    if (!Number.isFinite(severityThreshold) || severityThreshold < 1) {
        return 'Severity threshold must be at least 1.';
    }

    return null;
}

function renderRules(rules) {
    elements.rulesList.innerHTML = rules.length
        ? rules.map((rule) => `
            <article class="rule-card">
              <div class="card-row">
                <strong>${escapeHtml(rule.rule_name)}</strong>
                <span class="badge">${escapeHtml(rule.rule_type)}</span>
                <span class="badge ${rule.severity === 'critical' ? 'danger' : 'warn'}">${escapeHtml(rule.severity)}</span>
              </div>
              <div>${escapeHtml(rule.message)}</div>
              <div class="meta-row">
                <span>${escapeHtml(rule.pattern)}</span>
              </div>
              <div class="card-row">
                <button class="btn btn-secondary" data-edit-rule="${escapeHtml(rule.id)}">Edit</button>
                <button class="btn btn-ghost" data-delete-rule="${escapeHtml(rule.id)}">Delete</button>
              </div>
            </article>
        `).join('')
        : '<div class="empty-state">No custom rules yet for this repository.</div>';

    elements.rulesList.querySelectorAll('[data-edit-rule]').forEach((button) => {
        button.addEventListener('click', () => {
            const rule = rules.find((entry) => entry.id === Number(button.dataset.editRule));
            if (!rule) {
                return;
            }

            elements.ruleForm.dataset.ruleId = String(rule.id);
            elements.ruleForm.rule_name.value = rule.rule_name;
            elements.ruleForm.rule_type.value = rule.rule_type;
            elements.ruleForm.severity.value = rule.severity;
            elements.ruleForm.pattern.value = rule.pattern;
            elements.ruleForm.message.value = rule.message;
            elements.ruleTestOutput.textContent = `Editing rule #${rule.id}. Save to update it.`;
        });
    });

    elements.rulesList.querySelectorAll('[data-delete-rule]').forEach((button) => {
        button.addEventListener('click', async () => {
            const result = await window.electronAPI.deleteCustomRule(Number(button.dataset.deleteRule));
            if (result.success) {
                await loadRepositoryConfig();
            } else {
                elements.ruleTestOutput.textContent = result.error;
            }
        });
    });
}

async function refreshSnapshot() {
    const result = await window.electronAPI.getDashboardSnapshot({ rangeDays: state.rangeDays });
    if (!result.success) {
        setAPIStatus(result.error, false);
        addLog('error', result.error);
        return;
    }

    state.latestSnapshot = result.snapshot;
    state.repositories = result.snapshot.repositories;
    renderMetricCards(result.snapshot);
    renderReviewQueue(result.snapshot);
    renderActivityFeed(result.snapshot);
    renderOverviewWorkload(result.snapshot);
    renderConfigSummary(result.snapshot);
    renderRepositoryOptions(state.repositories, state.prs);
    renderMetrics(result.snapshot);
    setAPIStatus('Connected', true);
}

async function refreshPRList() {
    const filters = {
        status: elements.prStatusFilter.value,
        repositoryId: elements.prRepositoryFilter.value,
        authorId: elements.prAuthorFilter.value,
        search: elements.prSearchInput.value.trim()
    };
    const result = await window.electronAPI.listPRs(filters);
    if (!result.success) {
        addLog('error', result.error);
        return;
    }

    state.prs = result.prs;
    renderRepositoryOptions(state.repositories, state.prs);
    if (!state.selectedPrId && state.prs.length) {
        state.selectedPrId = state.prs[0].id;
    }

    renderPRList();

    if (state.selectedPrId) {
        await loadPRDetail(state.selectedPrId);
    }
}

async function loadPRDetail(prId) {
    const result = await window.electronAPI.getPRDetail(prId);
    if (!result.success) {
        elements.prDetailTitle.textContent = 'Select a PR';
        elements.prDetail.innerHTML = `<div class="empty-state">${escapeHtml(result.error)}</div>`;
        return;
    }

    renderPRDetail(result.detail);
}

async function loadTeamSecurity() {
    const result = await window.electronAPI.getTeamSecurityData();
    if (!result.success) {
        addLog('error', result.error);
        return;
    }

    state.teamSecurity = result.data;
    renderTeamSecurity();
}

async function loadRepositoryConfig() {
    const repositoryId = Number(elements.configRepositorySelect.value);
    if (!repositoryId) {
        return;
    }

    const result = await window.electronAPI.getRepositoryConfigData(repositoryId);
    if (!result.success) {
        elements.configValidation.textContent = result.error;
        return;
    }

    state.configPayload = result.payload;
    const { config, rules } = result.payload;
    elements.configForm.reviewInterval.value = config.reviewInterval ?? 600;
    elements.configForm.reviewMode.value = config.reviewMode ?? 'comment';
    elements.configForm.aiExecutor.value = config.aiExecutor ?? 'gemini';
    elements.configForm.autoMerge.value = String(Boolean(config.autoMerge));
    elements.configForm.severityThreshold.value = config.severityThreshold ?? 10;
    elements.configForm.logLevel.value = config.logLevel ?? 'info';
    elements.configValidation.textContent = `Editing ${result.payload.repository.full_name} on ${result.payload.repository.default_branch}.`;
    renderRules(rules);
}

function switchTab(tab) {
    state.selectedTab = tab;
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-page').forEach((page) => {
        page.classList.toggle('active', page.id === tab);
    });
    elements.toolbarTitle.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
}

function connectWebSocket() {
    if (!state.runtimeConfig?.wsUrl) {
        return;
    }

    if (state.ws) {
        state.ws.close();
    }

    elements.wsStatus.textContent = 'Connecting';
    elements.wsStatus.style.color = 'var(--warn)';

    const ws = new WebSocket(state.runtimeConfig.wsUrl);
    state.ws = ws;

    ws.addEventListener('open', () => {
        state.wsReconnectDelay = 1000;
        elements.wsStatus.textContent = 'Connected';
        elements.wsStatus.style.color = 'var(--success)';
        ws.send(JSON.stringify({
            type: 'auth',
            userId: state.runtimeConfig.wsUserId,
            token: state.runtimeConfig.wsToken
        }));
    });

    ws.addEventListener('message', async (event) => {
        try {
            const data = JSON.parse(event.data);
            await handleSocketMessage(data);
        } catch (error) {
            addLog('error', `WebSocket parse error: ${error.message}`);
        }
    });

    ws.addEventListener('close', () => {
        elements.wsStatus.textContent = 'Reconnecting';
        elements.wsStatus.style.color = 'var(--danger)';
        if (state.wsReconnectTimer) {
            clearTimeout(state.wsReconnectTimer);
        }
        state.wsReconnectTimer = setTimeout(connectWebSocket, state.wsReconnectDelay);
        state.wsReconnectDelay = Math.min(state.wsReconnectDelay * 2, 15000);
    });

    ws.addEventListener('error', () => {
        elements.wsStatus.textContent = 'Error';
        elements.wsStatus.style.color = 'var(--danger)';
    });
}

async function handleSocketMessage(data) {
    if (data.type === 'auth_success') {
        addLog('info', 'WebSocket authenticated');
        state.ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'dashboard'
        }));
        return;
    }

    if (data.type === 'subscription_success') {
        addLog('info', `Subscribed to ${data.channel}`);
        return;
    }

    if (data.type === 'review_started' || data.type === 'review_progress' || data.type === 'review_completed' || data.type === 'review_failed') {
        addLog('info', `${data.type}: ${JSON.stringify(data.payload)}`);
        await refreshSnapshot();
        await refreshPRList();
        return;
    }

    if (data.type === 'metrics_update' || data.type === 'pr_update') {
        await refreshSnapshot();
        await refreshPRList();
        return;
    }

    if (data.type === 'health_alert') {
        addLog('error', `Health alert: ${JSON.stringify(data.payload)}`);
        window.electronAPI.showNotification({
            title: 'Health Alert',
            body: 'A system health alert was received.'
        });
        await loadTeamSecurity();
    }
}

async function initialize() {
    const runtimeResult = await window.electronAPI.getRuntimeConfig();
    if (!runtimeResult.success) {
        addLog('error', runtimeResult.error);
        return;
    }

    state.runtimeConfig = runtimeResult.config;
    updateRunningState(false);
    await refreshSnapshot();
    await refreshPRList();
    await loadTeamSecurity();
    connectWebSocket();
    if (state.repositories.length) {
        elements.configRepositorySelect.value = String(state.repositories[0].id);
        await loadRepositoryConfig();
    }
}

elements.navTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) {
        return;
    }

    switchTab(button.dataset.tab);
});

elements.globalRange.addEventListener('change', async () => {
    state.rangeDays = Number(elements.globalRange.value);
    await refreshSnapshot();
});

elements.refreshAllBtn.addEventListener('click', async () => {
    await refreshSnapshot();
    await refreshPRList();
    await loadTeamSecurity();
    await loadRepositoryConfig();
});

elements.startBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.startReview({ once: false });
    if (result.success) {
        updateRunningState(true);
        addLog('info', 'Review loop started');
    } else {
        addLog('error', result.message);
    }
});

elements.startOnceBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.startReview({ once: true });
    if (result.success) {
        updateRunningState(true);
        addLog('info', 'Single review started');
    } else {
        addLog('error', result.message);
    }
});

elements.executeNowBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.executeNow();
    addLog(result.success ? 'info' : 'error', result.message);
});

elements.stopBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.stopReview();
    if (result.success) {
        updateRunningState(false);
        addLog('info', 'Review loop stopped');
    } else {
        addLog('error', result.message);
    }
});

elements.prStatusFilter.addEventListener('change', refreshPRList);
elements.prRepositoryFilter.addEventListener('change', refreshPRList);
elements.prAuthorFilter.addEventListener('change', refreshPRList);
elements.prSearchInput.addEventListener('input', refreshPRList);

elements.exportMetricsBtn.addEventListener('click', async () => {
    const filters = {
        ...state.rangeDays ? {
            startDate: new Date(Date.now() - state.rangeDays * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
        } : {}
    };

    const result = await window.electronAPI.exportMetricsData({ filters, format: 'csv' });
    if (!result.success) {
        elements.exportStatus.textContent = result.error;
        return;
    }

    elements.exportStatus.innerHTML = `Export created: <strong>${escapeHtml(result.result.fileName)}</strong><br>${escapeHtml(result.result.filePath)}`;
});

elements.configRepositorySelect.addEventListener('change', loadRepositoryConfig);

elements.configForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const repositoryId = Number(elements.configRepositorySelect.value);
    const formData = new FormData(elements.configForm);
    const payload = {
        reviewInterval: Number(formData.get('reviewInterval')),
        reviewMode: formData.get('reviewMode'),
        aiExecutor: formData.get('aiExecutor'),
        autoMerge: formData.get('autoMerge') === 'true',
        severityThreshold: Number(formData.get('severityThreshold')),
        logLevel: formData.get('logLevel')
    };

    const validationError = validateConfigPayload(payload);
    if (validationError) {
        elements.configValidation.textContent = validationError;
        return;
    }

    const result = await window.electronAPI.saveRepositoryConfigData({ repositoryId, config: payload });
    elements.configValidation.textContent = result.success
        ? 'Configuration saved successfully.'
        : result.error;

    if (result.success) {
        await refreshSnapshot();
        await loadRepositoryConfig();
    }
});

elements.testRuleBtn.addEventListener('click', async () => {
    const formData = new FormData(elements.ruleForm);
    const rule = {
        id: elements.ruleForm.dataset.ruleId ? Number(elements.ruleForm.dataset.ruleId) : undefined,
        rule_name: formData.get('rule_name'),
        rule_type: formData.get('rule_type'),
        severity: formData.get('severity'),
        pattern: formData.get('pattern'),
        message: formData.get('message')
    };

    const result = await window.electronAPI.testCustomRule({
        rule,
        sampleCode: elements.ruleSampleCode.value
    });

    elements.ruleTestOutput.textContent = result.success
        ? `Rule matched ${result.violations.length} violation(s).`
        : result.error;
});

elements.ruleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const repositoryId = Number(elements.configRepositorySelect.value);
    const formData = new FormData(elements.ruleForm);
    const rule = {
        id: elements.ruleForm.dataset.ruleId ? Number(elements.ruleForm.dataset.ruleId) : undefined,
        rule_name: formData.get('rule_name'),
        rule_type: formData.get('rule_type'),
        severity: formData.get('severity'),
        pattern: formData.get('pattern'),
        message: formData.get('message')
    };

    const result = await window.electronAPI.saveCustomRule({ repositoryId, rule });
    elements.ruleTestOutput.textContent = result.success
        ? `Rule saved with id ${result.ruleId}.`
        : result.error;

    if (result.success) {
        elements.ruleForm.reset();
        delete elements.ruleForm.dataset.ruleId;
        elements.ruleSampleCode.value = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';
        await loadRepositoryConfig();
    }
});

elements.resetRuleBtn.addEventListener('click', () => {
    elements.ruleForm.reset();
    delete elements.ruleForm.dataset.ruleId;
    elements.ruleSampleCode.value = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';
    elements.ruleTestOutput.textContent = 'Rule editor reset.';
});

elements.clearLogsBtn.addEventListener('click', () => {
    elements.logsContainer.innerHTML = '<div class="empty-state">No logs yet. Start the agent to stream process output.</div>';
});

window.electronAPI.onLogOutput((data) => {
    addLog(data.type, data.message);
});

window.electronAPI.onReviewStopped((data) => {
    updateRunningState(false);
    addLog('info', `Review process exited with code ${data.code}`);
});

initialize();
