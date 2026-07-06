<script lang="ts">
  /**
   * Accessible breadcrumb navigation with JSON-LD BreadcrumbList schema.
   * Port of astro-site Breadcrumbs.astro (inline JSON-LD behavior kept).
   */
  import { breadcrumbSchema } from '$lib/utils/seo';

  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  let { items }: { items: BreadcrumbItem[] } = $props();

  const SITE_URL = 'https://emoj.ie';

  const schemaItems = $derived(
    items
      .filter((item) => item.href)
      .map((item) => ({
        name: item.label,
        url: item.href!.startsWith('http') ? item.href! : `${SITE_URL}${item.href}`,
      }))
  );

  const jsonLdHtml = $derived(
    schemaItems.length > 0
      ? `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema(schemaItems))}<\/script>`
      : ''
  );
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
    {#each items as item, index (item.label)}
      <li>
        {#if index === items.length - 1}
          <span aria-current="page">{item.label}</span>
        {:else if item.href}
          <a href={item.href}>{item.label}</a>
        {:else}
          <span>{item.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

{#if jsonLdHtml}
  {@html jsonLdHtml}
{/if}

<style>
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  li:not(:last-child)::after {
    content: '\203A';
    margin-left: 0.25rem;
    color: var(--text-muted, #999);
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  [aria-current='page'] {
    font-weight: 600;
    color: var(--text-strong, #333);
  }
</style>
