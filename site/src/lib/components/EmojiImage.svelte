<script lang="ts">
  /**
   * Renders an emoji SVG image with CDN fallback metadata.
   * Port of astro-site EmojiImage.astro.
   */
  let {
    hex,
    annotation,
    size = 72,
    useLocal = true,
    loading = 'lazy',
    emoji = '',
  }: {
    hex: string;
    annotation: string;
    size?: number;
    useLocal?: boolean;
    loading?: 'lazy' | 'eager';
    emoji?: string;
  } = $props();

  const upperHex = $derived(hex.toUpperCase());
  const cdnSrc = $derived(`https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${upperHex}.svg`);
  const src = $derived(useLocal ? `/assets/emoji/base/${upperHex}.svg` : cdnSrc);
</script>

<span class="emoji-image-wrap">
  <img
    {src}
    alt={annotation}
    width={size}
    height={size}
    {loading}
    decoding="async"
    data-cdn-src={cdnSrc}
  />
  {#if emoji}
    <span class="emoji-image-fallback" aria-hidden="true">{emoji}</span>
  {/if}
</span>

<style>
  .emoji-image-wrap {
    display: inline-grid;
    place-items: center;
    position: relative;
  }

  img {
    object-fit: contain;
    display: block;
  }

  .emoji-image-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 2rem;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
  }
</style>
