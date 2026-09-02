<script lang="ts">
  interface EmojiItem {
    annotation: string;
    emoji: string;
    hexLower: string;
    assetHex: string;
    detailRoute: string;
    useLocalAsset: boolean;
  }

  let { emojis }: { emojis: EmojiItem[] } = $props();

  function imgSrc(item: EmojiItem): string {
    const hex = (item.assetHex || item.hexLower).toUpperCase();
    if (item.useLocalAsset !== false) {
      return `/assets/emoji/base/${hex}.svg`;
    }
    return `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${hex}.svg`;
  }
</script>

<div class="panel-grid">
  {#each emojis as item (item.hexLower)}
    <a href={item.detailRoute} class="panel-card" title={item.annotation}>
      <div class="panel-card-hero">
        <span class="emoji-image-wrap">
          <img
            src={imgSrc(item)}
            alt={item.annotation}
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
          />
        </span>
      </div>
      <span class="panel-card-title">{item.annotation}</span>
    </a>
  {/each}
</div>

<style>
  .emoji-image-wrap {
    display: inline-grid;
    place-items: center;
  }

  .emoji-image-wrap img {
    object-fit: contain;
    display: block;
  }
</style>
