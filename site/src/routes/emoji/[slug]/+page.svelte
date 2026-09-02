<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import EmojiImage from '$lib/components/EmojiImage.svelte';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import FavoriteButton from '$lib/components/FavoriteButton.svelte';
  import SkinTonePicker from '$lib/components/SkinTonePicker.svelte';
  import { organizationSchema, emojiDetailSchema } from '$lib/utils/seo';
  import { humanize } from '$lib/utils/copy-formats';

  let { data } = $props();

  const SITE_URL = 'https://emoj.ie';
  const emoji = $derived(data.emoji);
  const categoryTitle = $derived(humanize(data.breadcrumbData.categoryKey));
  const subgroupTitle = $derived(humanize(data.breadcrumbData.subgroupKey));
  const title = $derived(`${emoji.annotation} Emoji | emoj.ie`);
  const description = $derived(
    `Copy the ${emoji.annotation} emoji (${emoji.emoji}). Browse ${subgroupTitle} emojis in ${categoryTitle}.`
  );
  const canonicalUrl = $derived(`${SITE_URL}${emoji.detailRoute}`);

  const breadcrumbItems = $derived([
    { label: 'Home', href: '/' },
    { label: categoryTitle, href: data.breadcrumbData.categoryRoute },
    { label: subgroupTitle, href: data.breadcrumbData.subgroupRoute },
    { label: emoji.annotation },
  ]);

  const jsonLd = $derived([organizationSchema(), emojiDetailSchema(emoji)]);

  interface MetaItem {
    label: string;
    value: string;
    href?: string;
  }

  const metaItems = $derived.by(() => {
    const items: MetaItem[] = [
      { label: 'Category', value: categoryTitle, href: data.breadcrumbData.categoryRoute },
      { label: 'Subgroup', value: subgroupTitle, href: data.breadcrumbData.subgroupRoute },
    ];
    if (emoji.unicode) {
      items.push({ label: 'Unicode', value: `${emoji.unicode}` });
    }
    if (emoji.cldrShortName) {
      items.push({ label: 'CLDR Name', value: emoji.cldrShortName });
    }
    items.push({ label: 'Hex Code', value: emoji.hexLower });
    if (emoji.tags.length > 0) {
      items.push({ label: 'Tags', value: emoji.tags.join(', ') });
    }
    if (emoji.cldrKeywords.length > 0) {
      items.push({ label: 'Keywords', value: emoji.cldrKeywords.join(', ') });
    }
    return items;
  });
</script>

<SeoHead
  {title}
  {description}
  {canonicalUrl}
  ogImage={emoji.cdnAssetPath}
  noindex={emoji.noindex}
  {jsonLd}
/>

<Breadcrumbs items={breadcrumbItems} />

<main id="main-content" class="page-main">
  <article class="emoji-detail">
    <h1 class="emoji-detail-title">{emoji.annotation}</h1>

    <div class="emoji-hero-panel">
      <div class="emoji-detail-hero">
        <EmojiImage
          hex={emoji.assetHex}
          annotation={emoji.annotation}
          size={96}
          useLocal={emoji.useLocalAsset}
          loading="eager"
          emoji={emoji.emoji}
        />
      </div>

      <div class="emoji-detail-art">
        <span class="detail-native-emoji" aria-label={emoji.annotation}>
          {emoji.emoji}
        </span>
      </div>

      <div class="emoji-actions">
        <CopyButton emoji={emoji.emoji} hex={emoji.hexLower} annotation={emoji.annotation} />
        <FavoriteButton hex={emoji.hexLower} />
      </div>
    </div>

    <dl class="emoji-meta">
      {#each metaItems as item (item.label)}
        <dt>{item.label}</dt>
        <dd>
          {#if item.href}
            <a href={item.href}>{item.value}</a>
          {:else}
            {item.value}
          {/if}
        </dd>
      {/each}
    </dl>

    {#if data.skinToneVariants.length > 0}
      <section class="variant-section">
        <h2>Skin Tone Variants</h2>
        <SkinTonePicker variants={data.skinToneVariants} />
      </section>
    {/if}

    {#if data.otherVariants.length > 0}
      <section class="variant-section">
        <h2>Variants</h2>
        <ul class="variant-list">
          {#each data.otherVariants as variant (variant.assetHex)}
            <li>
              <EmojiImage
                hex={variant.assetHex}
                annotation={variant.annotation}
                size={36}
                useLocal={variant.useLocalAsset}
                emoji={variant.emoji}
              />
              <span>{variant.annotation}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </article>
</main>

<style>
  .detail-native-emoji {
    font-size: clamp(2.2rem, 4.5vw, 4rem);
    line-height: 1;
  }

  .emoji-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .variant-section {
    display: grid;
    gap: 0.5rem;
  }

  .variant-section h2 {
    font-size: 1.15rem;
    color: var(--text-strong);
  }

  .variant-list li {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .variant-list li span {
    font-size: 0.9rem;
    text-transform: capitalize;
  }
</style>
