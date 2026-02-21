(function () {
  var DETAIL_TRAIL_STORAGE_KEY = 'emojiDetailTrailV1';

  function track(eventName, props) {
    if (typeof window.plausible !== 'function') {
      return;
    }
    window.plausible(eventName, { props: props || {} });
  }

  function toTitleCaseLabel(value) {
    return String(value || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(function (part) {
        if (!part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  function normalizePathname(pathname) {
    var value = String(pathname || '/').split('#')[0].split('?')[0] || '/';
    if (!value.startsWith('/')) {
      value = '/' + value;
    }
    value = value.replace(/\/{2,}/g, '/');
    if (value.length > 1 && !value.endsWith('/')) {
      value += '/';
    }
    return value;
  }

  function renderDetailBreadcrumbFromTrail(trail, currentLabel) {
    var breadcrumbNav = document.querySelector('nav.breadcrumbs');
    if (!breadcrumbNav) {
      return;
    }

    breadcrumbNav.replaceChildren();
    trail.forEach(function (item, index) {
      if (index > 0) {
        breadcrumbNav.append(' / ');
      }
      if (item.href) {
        var link = document.createElement('a');
        link.href = item.href;
        link.textContent = toTitleCaseLabel(item.label);
        breadcrumbNav.appendChild(link);
      } else {
        var span = document.createElement('span');
        span.textContent = toTitleCaseLabel(item.label);
        breadcrumbNav.appendChild(span);
      }
    });

    if (trail.length > 0) {
      breadcrumbNav.append(' / ');
    }
    var current = document.createElement('span');
    current.textContent = toTitleCaseLabel(currentLabel);
    breadcrumbNav.appendChild(current);
    breadcrumbNav.setAttribute('data-breadcrumb-source', 'session');
  }

  function applyStoredDetailTrail() {
    if (!document.body.classList.contains('page-detail')) {
      return;
    }

    var breadcrumbNav = document.querySelector('nav.breadcrumbs');
    if (!breadcrumbNav) {
      return;
    }

    var raw = null;
    try {
      raw = sessionStorage.getItem(DETAIL_TRAIL_STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      return;
    }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed) {
      return;
    }

    var currentPath = normalizePathname(window.location.pathname);
    if (normalizePathname(parsed.path) !== currentPath) {
      return;
    }

    var trail = Array.isArray(parsed.trail)
      ? parsed.trail.filter(function (item) {
          return item && String(item.label || '').trim().length > 0;
        })
      : [];
    if (!trail.length) {
      return;
    }

    var labelNode = document.querySelector('.emoji-detail-title');
    var currentLabel = String(labelNode ? labelNode.textContent || '' : '').trim();
    if (!currentLabel) {
      return;
    }

    renderDetailBreadcrumbFromTrail(trail, currentLabel);
  }

  function createEmojiSupportDetector() {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    canvas.width = 32;
    canvas.height = 32;
    context.textBaseline = 'top';
    context.font =
      '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

    function draw(glyph) {
      context.clearRect(0, 0, 32, 32);
      context.fillText(glyph, 0, 0);
      return context.getImageData(0, 0, 32, 32).data;
    }

    function countOpaque(data) {
      var count = 0;
      for (var i = 3; i < data.length; i += 4) {
        if (data[i] > 0) count += 1;
      }
      return count;
    }

    function countColors(data, cap) {
      var max = Number(cap) > 0 ? Number(cap) : 16;
      var seen = new Set();
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (seen.size >= max) break;
      }
      return seen.size;
    }

    function diffCount(a, b) {
      var diff = 0;
      for (var i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) diff += 1;
      }
      return diff;
    }

    function meanAbsDiff(a, b) {
      var total = 0;
      for (var i = 0; i < a.length; i += 1) {
        total += Math.abs(a[i] - b[i]);
      }
      return total / a.length;
    }

    var replacement = new Uint8ClampedArray(draw('\ufffd'));
    var probeA = new Uint8ClampedArray(draw('\ue000'));
    var probeB = new Uint8ClampedArray(draw('\ue001'));
    var probeC = new Uint8ClampedArray(draw(String.fromCodePoint(0x10ffff)));

    return function (emoji) {
      var glyph = new Uint8ClampedArray(draw(String(emoji || '')));
      var opaque = countOpaque(glyph);
      if (opaque < 8) {
        return false;
      }
      if (diffCount(glyph, replacement) <= 100) {
        return false;
      }
      var closestProbe = Math.min(
        meanAbsDiff(glyph, probeA),
        meanAbsDiff(glyph, probeB),
        meanAbsDiff(glyph, probeC)
      );
      if (closestProbe < 6 && countColors(glyph, 16) <= 6 && opaque < 640) {
        return false;
      }
      return true;
    };
  }

  function initDetailEmojiFallback() {
    if (!document.body.classList.contains('page-detail')) {
      return;
    }

    var sourceButton = document.querySelector('.emoji-source-copy[data-copy-format="emoji"]');
    var heroNode = document.querySelector('.emoji-detail-hero');
    var artworkImage = document.querySelector('.emoji-detail-art img');
    if (!sourceButton || !heroNode || !artworkImage) {
      return;
    }

    var emoji = sourceButton.getAttribute('data-emoji') || String(heroNode.textContent || '').trim();
    if (!emoji) {
      return;
    }

    var detector = createEmojiSupportDetector();
    if (!detector) {
      return;
    }

    var supported = true;
    try {
      supported = detector(emoji);
    } catch {
      supported = true;
    }
    if (supported) {
      return;
    }

    var fallbackImage = document.createElement('img');
    fallbackImage.src = artworkImage.getAttribute('src') || '';
    fallbackImage.alt = '';
    fallbackImage.width = 96;
    fallbackImage.height = 96;
    fallbackImage.loading = 'eager';
    fallbackImage.className = 'emoji-detail-hero-fallback-art';

    var cdnSrc = artworkImage.getAttribute('data-cdn-src');
    if (cdnSrc) {
      fallbackImage.setAttribute('data-cdn-src', cdnSrc);
    }
    var hex = artworkImage.getAttribute('data-hex');
    if (hex) {
      fallbackImage.setAttribute('data-hex', hex);
    }

    heroNode.replaceChildren(fallbackImage);
    heroNode.setAttribute('data-render-fallback', 'openmoji');

    var hint = sourceButton.querySelector('.emoji-source-hint');
    if (hint) {
      hint.textContent = 'System glyph missing. Showing OpenMoji fallback. Click to copy emoji.';
    }

    track('emoji_render_fallback', {
      source: window.location.pathname,
      hex: sourceButton.getAttribute('data-hex') || '',
      group: sourceButton.getAttribute('data-group') || '',
      subgroup: sourceButton.getAttribute('data-subgroup') || '',
      format: 'emoji',
    });
  }

  applyStoredDetailTrail();
  initDetailEmojiFallback();
})();
