(function () {
  const THEME_PREFERENCE_KEY = 'themePreference';
  const THEME_SEQUENCE = ['system', 'light', 'dark'];

  function pickRandomSubset(items, limit) {
    var source = Array.isArray(items) ? items.slice() : [];
    var count = Math.min(limit, source.length);
    var result = [];

    for (var i = 0; i < count; i += 1) {
      var index = Math.floor(Math.random() * source.length);
      result.push(source[index]);
      source.splice(index, 1);
    }

    return result;
  }

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

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function readThemePreference() {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY) || 'system';
    if (THEME_SEQUENCE.indexOf(stored) === -1) {
      return 'system';
    }
    return stored;
  }

  function resolveTheme(preference) {
    if (preference === 'dark') return 'dark';
    if (preference === 'light') return 'light';
    return getSystemTheme();
  }

  function setDocumentTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function preferenceLabel(preference) {
    if (preference === 'dark') return 'Dark';
    if (preference === 'light') return 'Light';
    return 'System';
  }

  function updateThemeToggleButton(button, preference, theme) {
    if (!button) return;

    const glyphNode = button.querySelector('.theme-toggle-glyph');
    if (glyphNode) {
      if (preference === 'dark') {
        glyphNode.textContent = '◑';
      } else if (preference === 'light') {
        glyphNode.textContent = '◒';
      } else {
        glyphNode.textContent = '◐';
      }
    }

    button.setAttribute('data-theme-preference', preference);
    button.setAttribute('aria-label', `Theme: ${preferenceLabel(preference)} (${theme}). Activate to switch.`);
    button.setAttribute('title', `Theme: ${preferenceLabel(preference)} (${theme})`);

    const labelNode = button.querySelector('.theme-toggle-label');
    if (labelNode) {
      labelNode.textContent = `Theme: ${preferenceLabel(preference)}`;
    }
  }

  function initThemeToggle() {
    const buttons = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    let preference = readThemePreference();

    function applyTheme() {
      const theme = resolveTheme(preference);
      setDocumentTheme(theme);
      buttons.forEach(function (button) {
        updateThemeToggleButton(button, preference, theme);
      });
      return theme;
    }

    applyTheme();

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystemThemeChange = function () {
        if (preference === 'system') {
          applyTheme();
        }
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onSystemThemeChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onSystemThemeChange);
      }
    }

    if (!buttons.length) {
      return;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        const currentIndex = THEME_SEQUENCE.indexOf(preference);
        preference = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
        localStorage.setItem(THEME_PREFERENCE_KEY, preference);

        const theme = applyTheme();
        track('theme_toggle', {
          source: window.location.pathname,
          preference: preference,
          theme: theme,
        });
      });
    });
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

  function getMonthDayKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return month + '-' + day;
  }

  function applyDailyLogoEmoji() {
    var imageNode = document.querySelector('[data-logo-emoji-image]');
    var fallbackNode = document.querySelector('[data-logo-emoji-fallback]');
    if (!imageNode && !fallbackNode) {
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

        var monthDay = getMonthDayKey(new Date());
        var selected =
          rows.find(function (row) {
            return row && row.monthDay === monthDay;
          }) || rows[0];
        if (!selected || !selected.emoji) {
          return;
        }

        if (fallbackNode) {
          fallbackNode.textContent = selected.emoji;
        }

        if (imageNode && selected.hexcode) {
          var upperHex = String(selected.hexcode).toUpperCase();
          var localSrc = '/assets/emoji/base/' + upperHex + '.svg';
          var cdnSrc = 'https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/' + upperHex + '.svg';
          imageNode.src = localSrc;
          imageNode.setAttribute('data-cdn-src', cdnSrc);
        }

        var logoLink = (imageNode || fallbackNode).closest('.logo');
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

  function initAboutPlayground() {
    if (!document.body.classList.contains('page-about')) {
      return;
    }

    var wall = document.getElementById('about-emoji-wall');
    var shuffle = document.getElementById('about-shuffle');
    if (!wall || !shuffle) {
      return;
    }

    var pool = [
      { emoji: '😀', annotation: 'grinning face' },
      { emoji: '😎', annotation: 'smiling face with sunglasses' },
      { emoji: '🤖', annotation: 'robot' },
      { emoji: '🎉', annotation: 'party popper' },
      { emoji: '🚀', annotation: 'rocket' },
      { emoji: '🌈', annotation: 'rainbow' },
      { emoji: '🧠', annotation: 'brain' },
      { emoji: '🍕', annotation: 'pizza' },
      { emoji: '⚽', annotation: 'soccer ball' },
      { emoji: '🎧', annotation: 'headphones' },
      { emoji: '🦊', annotation: 'fox' },
      { emoji: '💡', annotation: 'light bulb' },
      { emoji: '✨', annotation: 'sparkles' },
      { emoji: '🌟', annotation: 'glowing star' },
    ];

    function renderWall() {
      var picks = pickRandomSubset(pool, 12);
      if (!picks.length) {
        return;
      }

      wall.replaceChildren();
      picks.forEach(function (item) {
        if (!item || !item.emoji) return;

        var label = item.annotation || 'emoji';
        var li = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'about-emoji-chip';
        button.setAttribute('data-copy-value', item.emoji);
        button.setAttribute('data-copy-label', label);
        button.setAttribute('data-copy-format', 'emoji');
        button.setAttribute('aria-label', 'Copy ' + label + ' emoji');

        var glyph = document.createElement('span');
        glyph.className = 'about-emoji-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = item.emoji;

        var small = document.createElement('small');
        small.textContent = label;

        button.appendChild(glyph);
        button.appendChild(small);
        li.appendChild(button);
        wall.appendChild(li);
      });

      wall.classList.remove('is-refreshing');
      void wall.offsetWidth;
      wall.classList.add('is-refreshing');
    }

    shuffle.addEventListener('click', function () {
      renderWall();
      track('about_shuffle', {
        source: window.location.pathname,
      });
    });

    fetch('/daily-emoji.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('daily emoji unavailable');
        }
        return response.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) {
          return;
        }

        var nextPool = rows
          .filter(function (item) {
            return item && item.emoji;
          })
          .map(function (item) {
            return {
              emoji: item.emoji,
              annotation: item.annotation || 'emoji',
            };
          });

        if (nextPool.length >= 12) {
          pool = nextPool;
          renderWall();
        }
      })
      .catch(function () {
        // Keep fallback pool.
      });
  }

  function initGlobalHeaderMenu() {
    if (document.body.classList.contains('page-home')) {
      return;
    }

    var toggle = document.getElementById('header-menu-toggle');
    var menu = document.getElementById('global-advanced-menu');
    var close = document.getElementById('global-advanced-close');
    var backdrop = document.getElementById('global-advanced-backdrop');
    var copyMode = document.getElementById('global-copy-mode');
    var skinToneMode = document.getElementById('global-skin-tone-mode');

    if (!toggle || !menu) {
      return;
    }

    function setOpen(open) {
      menu.hidden = !open;
      if (backdrop) {
        backdrop.hidden = !open;
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
    }

    var savedCopyMode = localStorage.getItem('copyMode') || 'emoji';
    if (copyMode) {
      if (['emoji', 'unicode', 'html', 'shortcode'].indexOf(savedCopyMode) === -1) {
        savedCopyMode = 'emoji';
      }
      copyMode.value = savedCopyMode;
      copyMode.addEventListener('change', function () {
        localStorage.setItem('copyMode', copyMode.value);
      });
    }

    var savedSkinTone = localStorage.getItem('defaultSkinTone') || '0';
    if (skinToneMode) {
      if (['0', '1', '2', '3', '4', '5'].indexOf(savedSkinTone) === -1) {
        savedSkinTone = '0';
      }
      skinToneMode.value = savedSkinTone;
      skinToneMode.addEventListener('change', function () {
        localStorage.setItem('defaultSkinTone', skinToneMode.value);
      });
    }

    toggle.addEventListener('click', function () {
      setOpen(menu.hidden);
    });

    if (close) {
      close.addEventListener('click', function () {
        setOpen(false);
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', function () {
        setOpen(false);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) {
        setOpen(false);
      }
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
  initThemeToggle();
  applyDailyLogoEmoji();
  initAboutPlayground();
  initGlobalHeaderMenu();
})();
