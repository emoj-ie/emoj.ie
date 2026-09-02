<script lang="ts">
  import { page } from '$app/state';

  const is404 = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{is404 ? 'Page Not Found' : 'Something Went Wrong'} | emoj.ie</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main id="main-content" class="page-main">
  <section class="panel-shell">
    <div class="not-found-content">
      <span class="not-found-emoji" aria-hidden="true">&#x1F615;</span>
      <h1>{is404 ? 'Page not found' : 'Something went wrong'}</h1>
      <p>
        {#if is404}
          We couldn't find what you were looking for. It may have moved or no longer exists.
        {:else}
          {page.error?.message ?? 'An unexpected error occurred.'}
        {/if}
      </p>
      <a href="/" class="copy-btn">Go back home</a>
    </div>
  </section>
</main>

<style>
  .not-found-content {
    text-align: center;
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    padding: 2rem 0;
  }

  .not-found-emoji {
    font-size: 4rem;
    line-height: 1;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }

  p {
    margin: 0;
    max-width: 42ch;
    color: var(--text-body);
    font-size: 1.05rem;
  }
</style>
