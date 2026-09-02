<script lang="ts">
  /**
   * Site header with logo badge, wordmark, Search, and ThemeSwitcher.
   * Port of astro-site Header.astro.
   */
  import Search from './Search.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<a href="#main-content" class="skip-link">Skip To Main Content</a>

<header class="header">
  <div class="header-container">
    <a href="/" class="logo" aria-label="emoj.ie home">
      <span class="logo-badge">
        <img class="logo-emoji" src="/assets/emoji/base/1F600.svg" alt="" width="26" height="26" />
        <span class="logo-emoji-fallback" aria-hidden="true"></span>
      </span>
      <span class="logo-wordmark">emoj.ie</span>
    </a>

    <Search />
    <ThemeSwitcher />
  </div>
</header>
