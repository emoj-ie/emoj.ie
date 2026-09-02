<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import EmojiImage from '$lib/components/EmojiImage.svelte';
  import { organizationSchema, websiteSchema } from '$lib/utils/seo';
  import { humanize } from '$lib/utils/copy-formats';

  let { data } = $props();

  const title = 'Search, Copy, And Explore Emojis | emoj.ie';
  const description =
    'Search emojis by category, copy in multiple formats, and jump to detailed pages.';
  const canonicalUrl = 'https://emoj.ie/';
  const jsonLd = [organizationSchema(), websiteSchema()];
</script>

<SeoHead {title} {description} {canonicalUrl} {jsonLd} />

<main id="main-content" class="page-main">
  <section class="panel-shell home-emoji-shell" aria-label="Emoji Explorer">
    <h1 class="visually-hidden">Emoji Categories</h1>
    <div class="panel-grid" data-level="group">
      {#each data.browsableCategories as cat (cat.key)}
        <a
          class="panel-card panel-card-link"
          href={cat.route}
          aria-label={`Open ${humanize(cat.key)}`}
        >
          <span class="panel-card-title">
            {cat.previewEmoji ? cat.previewEmoji.emoji : ''}
            {humanize(cat.key)}
          </span>
          <span class="panel-card-hero" aria-hidden="true">
            {#if cat.previewEmoji}
              <EmojiImage
                hex={cat.previewEmoji.assetHex}
                annotation={cat.previewEmoji.annotation}
                size={56}
                useLocal={cat.previewEmoji.useLocalAsset}
                emoji={cat.previewEmoji.emoji}
              />
            {/if}
          </span>
        </a>
      {/each}
    </div>
  </section>
</main>
