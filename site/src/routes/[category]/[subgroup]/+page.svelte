<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import EmojiGrid from '$lib/components/EmojiGrid.svelte';
  import { organizationSchema } from '$lib/utils/seo';
  import { humanize } from '$lib/utils/copy-formats';

  let { data } = $props();

  const SITE_URL = 'https://emoj.ie';
  const categoryTitle = $derived(humanize(data.parentCategory.key));
  const subgroupTitle = $derived(humanize(data.subgroup.key));
  const title = $derived(`${subgroupTitle} Emojis | ${categoryTitle} | emoj.ie`);
  const canonicalUrl = $derived(`${SITE_URL}${data.subgroup.route}`);

  const breadcrumbItems = $derived([
    { label: 'Home', href: '/' },
    { label: categoryTitle, href: data.parentCategory.route },
    { label: subgroupTitle },
  ]);

  const jsonLd = [organizationSchema()];
</script>

<SeoHead
  {title}
  description={data.subgroup.description}
  {canonicalUrl}
  noindex={data.subgroup.noindex}
  {jsonLd}
/>

<Breadcrumbs items={breadcrumbItems} />

<main id="main-content" class="page-main">
  <section class="subgroup">
    <h1 class="visually-hidden">{subgroupTitle} Emojis</h1>
    <EmojiGrid emojis={data.gridEmojis} />
  </section>
</main>
