import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    }),
  ],

  resolve: {
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'],
  },

  server: {
    port: 3000,
    open: true,
    hmr: true,
  },

  build: {
    outDir: 'build',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // MUI core + icons (split from each other)
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-mui-icons': ['@mui/icons-material'],
          // PayPal
          'vendor-paypal': ['@paypal/react-paypal-js'],
          // i18n
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          // Utilities
          'vendor-utils': ['axios', 'react-icons', 'react-toastify', 'react-ga4'],
        },
      },
    },
  },

  define: {
    global: 'globalThis',
  },

  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
    // Drop console.log in production
    drop: ['debugger'],
    legalComments: 'none',
  },

  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'load-js-files-as-jsx',
          setup(build) {
            build.onLoad({ filter: /src\/.*\.js$/ }, async (args) => {
              const { readFile } = await import('fs/promises');
              return {
                loader: 'jsx',
                contents: await readFile(args.path, 'utf8'),
              };
            });
          },
        },
      ],
    },
  },
});
