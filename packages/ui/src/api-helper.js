// Helper functions for HTTP API calls to backend server
// ESM version for Electron renderer process (Vite)

let API_BASE_URL = 'http://127.0.0.1:3000/api';

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'dev-key',
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            return { success: false, error: error.error || error.message || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export const api = {
    setBaseUrl: (url) => {
        API_BASE_URL = url;
    },

    // Dashboard
    getDashboardSnapshot: async ({ rangeDays = 30 } = {}) => {
        return apiCall(`/dashboard?rangeDays=${rangeDays}`);
    },

    // PRs
    scanPRs: async () => {
        return apiCall('/prs/scan');
    },

    scanIssues: async () => {
        return apiCall('/github/issues/scan');
    },

    listPRs: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.repositoryId) params.append('repositoryId', filters.repositoryId);
        if (filters.authorId) params.append('authorId', filters.authorId);
        if (filters.search) params.append('search', filters.search);
        if (filters.page) params.append('page', filters.page);
        if (filters.limit) params.append('limit', filters.limit);

        return apiCall(`/prs?${params.toString()}`);
    },

    getPRDetail: async (repo, number) => {
        const repoParam = repo.replace('/', '-');
        return apiCall(`/prs/${repoParam}/${number}`);
    },

    // Team & Security
    getTeamSecurityData: async () => {
        return apiCall('/team/security');
    },

    setDeveloperAvailability: async ({ developerId, isAvailable, unavailableUntil }) => {
        return apiCall(`/team/developers/${developerId}/availability`, {
            method: 'PUT',
            body: { is_available: isAvailable, unavailable_until: unavailableUntil }
        });
    },

    // Configuration
    getRepositoryConfigData: async (repoName) => {
        const repoParam = repoName.toString().replace('/', '-');
        return apiCall(`/config/${repoParam}`);
    },

    saveRepositoryConfigData: async ({ repoName, config }) => {
        const repoParam = repoName.toString().replace('/', '-');
        return apiCall(`/config/${repoParam}`, {
            method: 'PUT',
            body: config
        });
    },

    // Metrics
    exportMetricsData: async ({ filters, format = 'csv' }) => {
        return apiCall('/metrics/export', {
            method: 'POST',
            body: { filters, format }
        });
    },

    // History
    getHistory: async (limit = 50) => {
        return apiCall(`/reviews?limit=${limit}`);
    },

    getStats: async () => {
        return apiCall('/metrics/overview');
    }
};
