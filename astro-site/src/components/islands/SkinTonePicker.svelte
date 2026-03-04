<script lang="ts">
  import { getSkinTone, setSkinTone } from '../../lib/state/skin-tone.svelte';

  interface Variant {
    emoji: string;
    hexLower: string;
    annotation: string;
    localAssetPath: string;
    cdnAssetPath: string;
    assetHex?: string;
    useLocalAsset?: boolean;
  }

  let { variants }: { variants: Variant[] } = $props();

  let currentTone = $state(getSkinTone());
  let copiedHex = $state('');

  async function handlePick(variant: Variant) {
    // Update skin tone preference
    currentTone = variant.hexLower;
    setSkinTone(variant.hexLower);

    // Copy the emoji
    try {
      await navigator.clipboard.writeText(variant.emoji);
    } catch {
      // Safari fallback
      const textarea = document.createElement('textarea');
      textarea.value = variant.emoji;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    copiedHex = variant.hexLower;
    setTimeout(() => {
      copiedHex = '';
    }, 1500);
  }

  function imgSrc(variant: Variant): string {
    const hex = (variant.assetHex || variant.hexLower).toUpperCase();
    if (variant.useLocalAsset !== false) {
      return `/assets/emoji/base/${hex}.svg`;
    }
    return `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${hex}.svg`;
  }
</script>

{#if variants.length > 0}
  <div class="skin-tone-picker">
    <span class="skin-tone-label">Skin tones</span>
    <div class="skin-tone-grid" role="group" aria-label="Skin tone variants">
      {#each variants as variant (variant.hexLower)}
        <button
          type="button"
          class="skin-tone-btn"
          class:selected={currentTone === variant.hexLower}
          class:copied={copiedHex === variant.hexLower}
          aria-label={variant.annotation}
          title={variant.annotation}
          onclick={() => handlePick(variant)}
        >
          <img
            src={imgSrc(variant)}
            alt={variant.annotation}
            width="32"
            height="32"
            loading="lazy"
          />
          {#if copiedHex === variant.hexLower}
            <span class="copied-badge">Copied!</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .skin-tone-picker {
    display: grid;
    gap: 0.4rem;
  }

  .skin-tone-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-strong, #333);
  }

  .skin-tone-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .skin-tone-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    background: var(--bg-surface, #fff);
    cursor: pointer;
    padding: 0.2rem;
    transition: border-color 0.15s ease;
  }

  .skin-tone-btn:hover {
    border-color: var(--border-hover, #bbb);
  }

  .skin-tone-btn.selected {
    border-color: var(--color-accent, #3b82f6);
  }

  .skin-tone-btn img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .copied-badge {
    position: absolute;
    bottom: -1.25rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.65rem;
    white-space: nowrap;
    color: var(--color-success, #16a34a);
    font-weight: 600;
  }
</style>
