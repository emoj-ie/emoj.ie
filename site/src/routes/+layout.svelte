<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let { children } = $props();

  // Page-scope styling hook (.page-home, .page-detail, ...): the legacy CSS
  // targets these as ancestor selectors, so a wrapper div works in place of
  // the old body class.
  const bodyClass = $derived(page.data?.bodyClass ?? '');
</script>

<div class={bodyClass} style="display: contents">
  <Header />
  {@render children()}
  <Footer />
</div>
