<script lang="ts">
  import { toggleFavorite, isFavorite } from '../../lib/state/favorites.svelte';

  let { hex }: { hex: string } = $props();

  let favorited = $state(isFavorite(hex));

  function handleToggle() {
    toggleFavorite(hex);
    favorited = isFavorite(hex);
  }
</script>

<button
  type="button"
  class="favorite-btn"
  class:active={favorited}
  aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
  aria-pressed={favorited}
  onclick={handleToggle}
>
  <span class="favorite-icon" aria-hidden="true">
    {#if favorited}
      &#x2764;&#xFE0F;
    {:else}
      &#x1F90D;
    {/if}
  </span>
  <span class="favorite-label">{favorited ? 'Favorited' : 'Favorite'}</span>
</button>

<style>
  .favorite-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border-default, #ddd);
    border-radius: 0.5rem;
    background: var(--bg-surface, #fff);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s ease;
    color: var(--text-body, #333);
    font-family: inherit;
  }

  .favorite-btn:hover {
    background: var(--bg-hover, #f5f5f5);
    border-color: var(--border-hover, #ccc);
  }

  .favorite-btn.active {
    border-color: var(--color-accent, #e74c3c);
    background: var(--bg-accent-subtle, #fef2f2);
  }

  .favorite-icon {
    font-size: 1.1rem;
    line-height: 1;
  }
</style>
