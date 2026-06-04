import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// The simulator lives in the sibling package ../zigan-simulation; resolve it to source so
// Vite transpiles its TS/TSX as first-party code (and dedupe React to avoid a second copy).
const ziganEntry = fileURLToPath(new URL('../zigan-simulation/src/index.ts', import.meta.url));

export default defineConfig({
  site: 'https://uqslee65.github.io',
  integrations: [react(), mdx()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { 'zigan-simulation': ziganEntry },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      fs: { allow: ['..'] },
      proxy: {
        '/ollama': {
          target: 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama/, ''),
        },
        '/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/anthropic/, ''),
        },
      },
    },
  },
});
