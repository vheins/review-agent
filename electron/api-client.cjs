// API client for Electron to communicate with backend server
const http = require('http');

class APIClient {
    constructor(baseUrl = 'http://127.0.0.1:3000') {
        this.baseUrl = baseUrl;
    }

    async request(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const requestOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = http.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async get(path) {
        return this.request(path, { method: 'GET' });
    }

    async post(path, body) {
        return this.request(path, { method: 'POST', body });
    }

    async put(path, body) {
        return this.request(path, { method: 'PUT', body });
    }

    async delete(path) {
        return this.request(path, { method: 'DELETE' });
    }
}

module.exports = { APIClient };
