import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  const backendUrl = env.REACT_APP_API_URL 
    ? env.REACT_APP_API_URL.replace(/\/api\/?$/, '') 
    : (env.REACT_APP_SOCKET_URL || 'http://localhost:9410');

  return {
    plugins: [react()],

    // Path resolution aliases
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Centralized environment variable compatibility with CRA (process.env.REACT_APP_*)
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(mode),
        REACT_APP_API_URL: env.REACT_APP_API_URL || '/api',
        REACT_APP_SOCKET_URL: env.REACT_APP_SOCKET_URL || backendUrl,
        ...Object.keys(env)
          .filter((key) => key.startsWith('REACT_APP_') || key.startsWith('VITE_'))
          .reduce((acc, key) => {
            acc[key] = env[key];
            return acc;
          }, {}),
      },
    },

    // Development server with centralized reverse proxy & WebSocket forwarding
    server: {
      port: parseInt(env.PORT, 10) || 8579,
      host: '0.0.0.0', // Allows LAN / staging domain access
      strictPort: true,
      cors: true,
      proxy: {
        // Forward API requests to backend
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        // Forward Socket.IO WebSocket connections for live monitoring
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        // Forward uploads / static assets if served by backend
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Production preview server settings
    preview: {
      port: parseInt(env.PORT, 10) || 8579,
      host: '0.0.0.0',
    },

    // Optimized Production Build configuration
    build: {
      outDir: 'build', // Keeps compatibility with existing build folders and deploy scripts
      emptyOutDir: true,
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          // Centralized code splitting for high performance caching
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // PDF & Document processing heavy libraries
              if (
                id.includes('jspdf') ||
                id.includes('pdf-lib') ||
                id.includes('react-pdf') ||
                id.includes('docx-preview') ||
                id.includes('docxtemplater') ||
                id.includes('mammoth') ||
                id.includes('pizzip') ||
                id.includes('xlsx') ||
                id.includes('jszip')
              ) {
                return 'vendor-documents';
              }

              // Visuals, Charts & UI icons
              if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('html2canvas')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react') || id.includes('@monaco-editor')) {
                return 'vendor-ui-icons';
              }

              // React Core & Router
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('react-router-dom') ||
                id.includes('axios') ||
                id.includes('socket.io-client')
              ) {
                return 'vendor-core';
              }

              return 'vendor-misc';
            }
          },
        },
      },
    },
  };
});
