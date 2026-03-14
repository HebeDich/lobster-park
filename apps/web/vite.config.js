import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
function manualChunks(id) {
    if (id.includes('/src/api/generated/')) {
        return 'api-client';
    }
    if (!id.includes('/node_modules/')) {
        return undefined;
    }
    if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
        return 'react-vendor';
    }
    if (id.includes('/react-router/') || id.includes('/react-router-dom/')) {
        return 'router-vendor';
    }
    if (id.includes('/zustand/')) {
        return 'state-vendor';
    }
    return undefined;
}
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 950,
        rollupOptions: {
            output: {
                manualChunks: manualChunks,
            },
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/ws': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
                ws: true,
            },
            '/api': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
            },
            '/health': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
            },
            '/ready': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
            },
            '/metrics': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
            },
            '/info': {
                target: process.env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:3301',
                changeOrigin: true,
            },
        },
    },
});
