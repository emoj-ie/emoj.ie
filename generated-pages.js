(function () {
  function track(eventName, props) {
    if (typeof window.plausible !== 'function') {
      return;
    }

    window.plausible(eventName, { props: props || {} });
  }

  function analyticsContext(element, defaultFormat) {
    return {
      source: window.location.pathname,
      hex: (element && element.getAttribute('data-hex')) || '',
      group: (element && element.getAttribute('data-group')) || '',
      subgroup: (element && element.getAttribute('data-subgroup')) || '',
      format: (element && element.getAttribute('data-format')) || defaultFormat || '',
    };
  }

  function ensureLiveRegion() {
    let region = document.getElementById('live-region');
    if (region) {
      return region;
    }

    region = document.createElement('div');
    region.id = 'live-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-9999px';
    region.style.top = 'auto';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    document.body.appendChild(region);
    return region;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    const liveRegion = ensureLiveRegion();
    liveRegion.textContent = message;

    window.setTimeout(function () {
      toast.classList.add('hide');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
    }, 1800);
  }

  async function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const temp = document.createElement('input');
    temp.value = value;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        // Ignore registration errors for static hosting edge-cases.
      });
    });
  }

  function getDayOfYear(date) {
    var start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    var now = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    return Math.floor((now - start) / 86400000) + 1;
  }

  function applyDailyLogoEmoji() {
    var emojiNode = document.querySelector('[data-logo-emoji]');
    if (!emojiNode) {
      return;
    }

    fetch('/daily-emoji.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('daily emoji unavailable');
        }
        return response.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          return;
        }

        var day = getDayOfYear(new Date());
        var selected = rows[Math.min(rows.length, day) - 1] || rows[0];
        if (!selected || !selected.emoji) {
          return;
        }

        emojiNode.textContent = selected.emoji;
        var logoLink = emojiNode.closest('.logo');
        if (logoLink) {
          var label = selected.annotation || 'Emoji of the day';
          logoLink.setAttribute('title', 'Emoji of the day: ' + label);
          logoLink.setAttribute('aria-label', 'emoj.ie home. Emoji of the day: ' + label);
        }
      })
      .catch(function () {
        // Keep fallback emoji in markup.
      });
  }

  document.addEventListener('click', function (event) {
    const shareButton = event.target.closest('[data-share-url]');
    if (shareButton) {
      const shareUrl = shareButton.getAttribute('data-share-url');
      if (shareUrl) {
        copyText(shareUrl)
          .then(function () {
            showToast('Link copied');
            track('share', {
              ...analyticsContext(shareButton, 'url'),
              route: shareButton.getAttribute('data-route') || '',
            });
          })
          .catch(function () {
            showToast('Share failed. Try again.');
          });
      }
      return;
    }

    const variantLink = event.target.closest('[data-variant-select]');
    if (variantLink) {
      const targetHex = variantLink.getAttribute('data-variant-to') || '';
      track('variant_select', {
        ...analyticsContext(variantLink, 'variant'),
        hex: targetHex,
        from: variantLink.getAttribute('data-variant-from') || '',
        to: targetHex,
      });
    }

    const button = event.target.closest('[data-copy-value]');
    if (!button) {
      return;
    }

    const value = button.getAttribute('data-copy-value');
    const label = button.getAttribute('data-copy-label') || value;
    if (!value) {
      return;
    }

    copyText(value)
      .then(function () {
        showToast('Copied: ' + label);
        const copyFormat = button.getAttribute('data-copy-format') || 'emoji';
        track('copy', {
          ...analyticsContext(button, copyFormat),
          format: copyFormat,
        });
        document.dispatchEvent(
          new CustomEvent('emoji:copied', {
            detail: {
              value: value,
              label: label,
              trigger: button,
            },
          })
        );
      })
      .catch(function () {
        showToast('Copy failed. Try again.');
      });
  });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      const search = document.getElementById('search');
      if (search) {
        event.preventDefault();
        search.focus();
      }
    }
  });

  document.addEventListener(
    'error',
    function (event) {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) {
        return;
      }

      const fallback = image.dataset.cdnSrc;
      if (!fallback || image.src === fallback) {
        return;
      }

      image.src = fallback;
    },
    true
  );

  registerServiceWorker();
  applyDailyLogoEmoji();
})();
