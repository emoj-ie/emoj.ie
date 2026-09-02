<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import EmojiImage from '$lib/components/EmojiImage.svelte';
  import { organizationSchema, categoryPageSchema } from '$lib/utils/seo';
  import { humanize } from '$lib/utils/copy-formats';

  let { data } = $props();

  const SITE_URL = 'https://emoj.ie';
  const categoryTitle = $derived(humanize(data.category.key));
  const title = $derived(`${categoryTitle} Emojis | emoj.ie`);
  const canonicalUrl = $derived(`${SITE_URL}${data.category.route}`);

  const breadcrumbItems = $derived([{ label: 'Home', href: '/' }, { label: categoryTitle }]);

  // Breadcrumb JSON-LD is rendered by the Breadcrumbs component
  const jsonLd = $derived([organizationSchema(), categoryPageSchema(data.category)]);
</script>

<SeoHead
  {title}
  description={data.category.description}
  {canonicalUrl}
  noindex={data.category.noindex}
  {jsonLd}
/>

<Breadcrumbs items={breadcrumbItems} />

<main id="main-content" class="page-main">
  <section class="panel-shell home-emoji-shell">
    <h1 class="visually-hidden">{categoryTitle}</h1>
    <div class="panel-grid panel-grid-balanced">
      {#each data.subgroups as sg (sg.key)}
        <a
          class="panel-card panel-card-link"
          href={sg.route}
          aria-label={`Open ${humanize(sg.key)}`}
        >
          <span class="panel-card-title">
            {sg.previewEmoji ? sg.previewEmoji.emoji : ''}
            {humanize(sg.key)}
          </span>
          <span class="panel-card-hero" aria-hidden="true">
            {#if sg.previewEmoji}
              <EmojiImage
                hex={sg.previewEmoji.assetHex}
                annotation={sg.previewEmoji.annotation}
                size={56}
                useLocal={sg.previewEmoji.useLocalAsset}
                emoji={sg.previewEmoji.emoji}
              />
            {/if}
          </span>
        </a>
      {/each}
    </div>
  </section>
</main>
