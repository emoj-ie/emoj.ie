<script lang="ts">
  import { formatCopyValue, COPY_MODES, type CopyMode } from '../../lib/utils/copy-formats';
  import { getCopyMode, setCopyMode } from '../../lib/state/copy-mode.svelte';
  import { addRecent } from '../../lib/state/recents.svelte';

  let { emoji, hex, annotation }: {
    emoji: string;
    hex: string;
    annotation: string;
  } = $props();

  let copyMode = $state<CopyMode>(getCopyMode());
  let copied = $state(false);
  let showModeSelector = $state(false);

  function getCopyValue(): string {
    return formatCopyValue(copyMode, { emoji, hexLower: hex, annotation });
  }

  async function handleCopy() {
    const value = getCopyValue();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Safari fallback: synchronous copy in click handler
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    addRecent(hex);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }

  function selectMode(mode: CopyMode) {
    copyMode = mode;
    setCopyMode(mode);
    showModeSelector = false;
  }

  function toggleModeSelector() {
    showModeSelector = !showModeSelector;
  }

  function modeLabel(mode: string): string {
    switch (mode) {
      case 'emoji': return 'Emoji';
      case 'unicode': return 'Unicode';
      case 'html': return 'HTML';
      case 'shortcode': return 'Shortcode';
      default: return mode;
    }
  }
</script>

<div class="copy-island">
  <div class="copy-main">
    <button
      type="button"
      class="copy-btn"
      class:copied
      onclick={handleCopy}
      aria-label="Copy {annotation} as {copyMode}"
    >
      {#if copied}
        <span class="copy-feedback">Copied!</span>
      {:else}
        <span class="copy-value"><code>{getCopyValue()}</code></span>
        <span class="copy-hint">Click to copy</span>
      {/if}
    </button>

    <button
      type="button"
      class="mode-toggle"
      onclick={toggleModeSelector}
      aria-label="Change copy format (current: {copyMode})"
      aria-expanded={showModeSelector}
    >
      <span class="mode-current">{modeLabel(copyMode)}</span>
      <span class="mode-arrow" aria-hidden="true">{showModeSelector ? '\u25B2' : '\u25BC'}</span>
    </button>
  </div>

  {#if showModeSelector}
    <div class="mode-selector" role="listbox" aria-label="Copy format">
      {#each COPY_MODES as mode (mode)}
        <button
          type="button"
          role="option"
          class="mode-option"
          class:active={copyMode === mode}
          aria-selected={copyMode === mode}
          onclick={() => selectMode(mode)}
        >
          <span class="mode-option-label">{modeLabel(mode)}</span>
          <code class="mode-option-preview">{formatCopyValue(mode, { emoji, hexLower: hex, annotation })}</code>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .copy-island {
    display: grid;
    gap: 0.25rem;
  }

  .copy-main {
    display: flex;
    gap: 0;
  }

  .copy-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--border-default, #ddd);
    border-right: none;
    border-radius: 0.5rem 0 0 0.5rem;
    background: var(--bg-surface, #fff);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-body, #333);
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  .copy-btn.copied {
    background: var(--bg-success, #dcfce7);
    border-color: var(--color-success, #16a34a);
  }

  .copy-value code {
    font-family: var(--font-mono, monospace);
    font-size: 1rem;
    word-break: break-all;
  }

  .copy-hint {
    font-size: 0.75rem;
    color: var(--text-muted, #888);
  }

  .copy-feedback {
    font-weight: 600;
    color: var(--color-success, #16a34a);
    font-size: 0.95rem;
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border-default, #ddd);
    border-radius: 0 0.5rem 0.5rem 0;
    background: var(--bg-surface, #fff);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    color: var(--text-body, #333);
    white-space: nowrap;
  }

  .mode-toggle:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  .mode-arrow {
    font-size: 0.6rem;
  }

  .mode-selector {
    display: grid;
    border: 1px solid var(--border-default, #ddd);
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--bg-surface, #fff);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .mode-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: none;
    border-bottom: 1px solid var(--border-subtle, #eee);
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    color: var(--text-body, #333);
    text-align: left;
  }

  .mode-option:last-child {
    border-bottom: none;
  }

  .mode-option:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  .mode-option.active {
    background: var(--bg-accent-subtle, #eff6ff);
    font-weight: 600;
  }

  .mode-option-preview {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    color: var(--text-muted, #888);
    text-align: right;
  }
</style>
