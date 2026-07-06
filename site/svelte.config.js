import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // GitHub Pages serves 404.html (with a real 404 status) for unknown
      // paths. This is an SPA shell that boots the router and renders
      // +error.svelte. Do NOT create a /404 route: with trailingSlash
      // 'always' it would emit 404/index.html, which Pages ignores.
      fallback: '404.html',
    }),
    prerender: {
      handleHttpError: 'fail',
      handleMissingId: 'warn',
    },
  },
};

export default config;
