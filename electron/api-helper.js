// Helper functions for HTTP API calls to backend server

const API_BASE_URL = 'http://127.0.0.1:3000/api';

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
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
    // Dashboard
    getDashboardSnapshot: async ({ rangeDays = 30 } = {}) => {
        return apiCall(`/dashboard?rangeDays=${rangeDays}`);
    },

    // PRs
    listPRs: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.repositoryId) params.append('repositoryId', filters.repositoryId);
        if (filters.authorId) params.append('authorId', filters.authorId);
        if (filters.search) params.append('search', filters.search);

        return apiCall(`/prs?${params.toString()}`);
    },

    getPRDetail: async (prId) => {
        return apiCall(`/prs/${prId}`);
    },

    // Team & Security
    getTeamSecurityData: async () => {
        return apiCall('/team/security');
    },

    setDeveloperAvailability: async (payload) => {
        return apiCall('/team/availability', {
            method: 'POST',
            body: payload
        });
    },

    // Configuration
    getRepositoryConfigData: async (repositoryId) => {
        return apiCall(`/config/repository/${repositoryId}`);
    },

    saveRepositoryConfigData: async (payload) => {
        return apiCall('/config/repository', {
            method: 'POST',
            body: payload
        });
    },

    // Rules
    saveCustomRule: async (payload) => {
        return apiCall('/config/rules', {
            method: 'POST',
            body: payload
        });
    },

    deleteCustomRule: async (ruleId) => {
        return apiCall(`/config/rules/${ruleId}`, {
            method: 'DELETE'
        });
    },

    testCustomRule: async (payload) => {
        return apiCall('/config/rules/test', {
            method: 'POST',
            body: payload
        });
    },

    // Metrics
    exportMetricsData: async (payload) => {
        return apiCall('/metrics/export', {
            method: 'POST',
            body: payload
        });
    },

    // History
    getHistory: async (limit = 50) => {
        return apiCall(`/reviews/history?limit=${limit}`);
    },

    getStats: async () => {
        return apiCall('/reviews/stats');
    }
};
