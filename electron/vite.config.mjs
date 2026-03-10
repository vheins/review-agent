import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    root: path.resolve(import.meta.dirname),
    base: './',
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
