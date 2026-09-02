<script lang="ts">
  /**
   * Per-page <head> tags: title, description, canonical, robots, OG/Twitter
   * cards, and JSON-LD. Replaces the head section of astro-site BaseLayout.
   */
  let {
    title,
    description,
    canonicalUrl,
    ogImage = '',
    noindex = false,
    jsonLd = [],
  }: {
    title: string;
    description: string;
    canonicalUrl: string;
    ogImage?: string;
    noindex?: boolean;
    jsonLd?: object[];
  } = $props();

  const siteUrl = 'https://emoj.ie';
  const image = $derived(ogImage || `${siteUrl}/android-chrome-512x512.png`);

  const jsonLdHtml = $derived(
    jsonLd
      .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}<\/script>`)
      .join('\n')
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />

  {#if noindex}
    <meta name="robots" content="noindex, follow" />
  {/if}

  <meta property="og:type" content="website" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={image} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />

  {@html jsonLdHtml}
</svelte:head>
