<script lang="ts">
  import { getTheme, setTheme } from '../../lib/state/theme.svelte';

  type ThemeValue = 'light' | 'dark' | 'system';

  const THEMES: { value: ThemeValue; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '\u2600\uFE0F' },
    { value: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
    { value: 'system', label: 'System', icon: '\uD83D\uDCBB' },
  ];

  let current = $state<ThemeValue>(getTheme());

  function handleSwitch(value: ThemeValue) {
    current = value;
    setTheme(value);
  }
</script>

<div class="theme-switcher" role="radiogroup" aria-label="Theme preference">
  {#each THEMES as t (t.value)}
    <button
      type="button"
      role="radio"
      aria-checked={current === t.value}
      aria-label={t.label}
      class="theme-btn"
      class:active={current === t.value}
      onclick={() => handleSwitch(t.value)}
    >
      <span class="theme-icon" aria-hidden="true">{t.icon}</span>
    </button>
  {/each}
</div>

<style>
  .theme-switcher {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    border-radius: 0.5rem;
    padding: 0.125rem;
  }

  .theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.15s ease;
    padding: 0;
  }

  .theme-btn:hover {
    background-color: var(--bg-hover, rgba(0, 0, 0, 0.08));
  }

  .theme-btn.active {
    background-color: var(--bg-active, rgba(0, 0, 0, 0.12));
  }

  .theme-icon {
    line-height: 1;
  }
</style>
