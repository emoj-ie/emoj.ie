<script lang="ts">
  /**
   * Site footer with copyright and OpenMoji attribution.
   * Port of astro-site Footer.astro.
   */
  const year = new Date().getFullYear();
</script>

<footer>
  <div class="footer-links">
    <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">
      Powered by OpenMoji
    </a>
  </div>
  <p>&copy; {year} emoj.ie</p>
</footer>
