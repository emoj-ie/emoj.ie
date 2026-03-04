// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://emoj.ie',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    svelte(),
    sitemap({
      filter: (page) => !page.includes('/component/'),
    }),
  ],
});
