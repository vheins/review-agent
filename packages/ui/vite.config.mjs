import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    root: path.resolve(import.meta.dirname, 'src'),
    base: './',
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        hmr: {
            protocol: 'ws',
            host: '127.0.0.1',
            port: 5173
        }
    },
    build: {
        outDir: path.resolve(import.meta.dirname, 'dist'),
        emptyOutDir: true
    }
});
