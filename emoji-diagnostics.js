(function () {
  var CACHE_KEY = 'emojiTofuScoreV4';
  var CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
  var SCORE_VERSION = 4;

  function track(eventName, props) {
    if (typeof window.plausible !== 'function') {
      return;
    }
    window.plausible(eventName, { props: props || {} });
  }

  function idle(callback, timeout) {
    if (typeof window.requestIdleCallback === 'function') {
      return window.requestIdleCallback(callback, { timeout: timeout || 200 });
    }
    return window.setTimeout(function () {
      callback({
        timeRemaining: function () {
          return 0;
        },
      });
    }, 16);
  }

  function createEmojiSupportDetector() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      return null;
    }

    canvas.width = 32;
    canvas.height = 32;
    ctx.textBaseline = 'top';
    ctx.font =
      '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

    function countOpaquePixels(data) {
      var count = 0;
      for (var i = 3; i < data.length; i += 4) {
        if (data[i] > 0) count += 1;
      }
      return count;
    }

    function countUniqueColors(data, max) {
      var cap = Number(max) > 0 ? Number(max) : 24;
      var seen = new Set();
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        var key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        seen.add(key);
        if (seen.size >= cap) {
          break;
        }
      }
      return seen.size;
    }

    function pixelDiffCount(a, b) {
      var diff = 0;
      for (var i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) diff += 1;
      }
      return diff;
    }

    function meanAbsoluteDiff(a, b) {
      var total = 0;
      for (var i = 0; i < a.length; i += 1) {
        total += Math.abs(a[i] - b[i]);
      }
      return total / a.length;
    }

    function buildSharedMask(a, b) {
      var mask = new Uint8Array(a.length / 4);
      var size = 0;
      for (var i = 0, pixelIndex = 0; i < a.length; i += 4, pixelIndex += 1) {
        if (a[i + 3] > 0 && b[i + 3] > 0) {
          mask[pixelIndex] = 1;
          size += 1;
        }
      }
      return { mask: mask, size: size };
    }

    function maskCoverage(data, sharedMask) {
      if (!sharedMask || sharedMask.size < 8) return 0;
      var filled = 0;
      for (var i = 3, pixelIndex = 0; i < data.length; i += 4, pixelIndex += 1) {
        if (sharedMask.mask[pixelIndex] && data[i] > 0) {
          filled += 1;
        }
      }
      return filled / sharedMask.size;
    }

    function draw(glyph) {
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillText(glyph, 0, 0);
      return ctx.getImageData(0, 0, 32, 32).data;
    }

    var tofuData = new Uint8ClampedArray(draw('\ufffd'));
    var privateUseA = new Uint8ClampedArray(draw('\ue000'));
    var privateUseB = new Uint8ClampedArray(draw('\ue001'));
    var nonCharacter = new Uint8ClampedArray(draw(String.fromCodePoint(0x10ffff)));
    var tofuMask = buildSharedMask(privateUseA, privateUseB);
    if (tofuMask.size < 8) {
      tofuMask = buildSharedMask(tofuData, nonCharacter);
    }

    return function isEmojiSupported(emoji) {
      var emojiData = draw(emoji);
      var opaque = countOpaquePixels(emojiData);
      if (opaque < 8) {
        return false;
      }

      var diffToReplacement = pixelDiffCount(emojiData, tofuData);
      if (diffToReplacement <= 100) {
        return false;
      }

      var closestProbe = Math.min(
        meanAbsoluteDiff(emojiData, privateUseA),
        meanAbsoluteDiff(emojiData, privateUseB),
        meanAbsoluteDiff(emojiData, nonCharacter)
      );
      var colors = countUniqueColors(emojiData, 16);
      var probeCoverage = maskCoverage(emojiData, tofuMask);

      // Some platforms render tofu as a monochrome framed glyph with inline code text.
      if (closestProbe < 6 && colors <= 6 && opaque < 640) {
        return false;
      }
      if (probeCoverage > 0.9 && colors <= 4 && opaque < 700) {
        return false;
      }

      return true;
    };
  }

  function parsePool(rows) {
    var seen = new Set();
    var pool = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !row.emoji) return;
      var hex = String(row.hexcode || row.hexLower || '').toLowerCase();
      var key = hex || String(row.emoji);
      if (!key || seen.has(key)) return;
      seen.add(key);
      pool.push({
        emoji: String(row.emoji),
        hex: hex,
        annotation: String(row.annotation || '').trim(),
        detailRoute: String(row.detailRoute || '')
          .replace(/^\/+/, '')
          .trim(),
        group: String(row.group || '').trim(),
        subgroup: String(row.subgroup || '').trim(),
        useLocalAsset: Boolean(row.useLocalAsset),
        cdnAssetPath: String(row.cdnAssetPath || '').trim(),
      });
    });
    return pool;
  }

  function normalizeRoute(route) {
    var value = String(route || '').replace(/^\/+/, '').trim();
    if (!value) return '';
    return value.endsWith('/') ? value : value + '/';
  }

  function toTitle(value) {
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

  function guessLabel(row) {
    var annotation = String(row && row.annotation ? row.annotation : '').trim();
    if (annotation) return annotation;
    var route = normalizeRoute(row && row.detailRoute);
    if (!route) return 'emoji';
    var parts = route.split('/').filter(Boolean);
    var slug = parts.length ? parts[parts.length - 1] : route;
    var withoutHex = slug.replace(/--[0-9a-f][0-9a-f-]*$/i, '');
    return toTitle(withoutHex) || 'emoji';
  }

  function assetForRow(row) {
    var upperHex = String(row && row.hex ? row.hex : '').toUpperCase();
    var localSrc = '/assets/emoji/base/' + upperHex + '.svg';
    var cdnSrc =
      String(row && row.cdnAssetPath ? row.cdnAssetPath : '') ||
      'https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/' + upperHex + '.svg';
    var useLocal = Boolean(row && row.useLocalAsset) && String(row.group || '').toLowerCase() !== 'component';
    return {
      src: useLocal ? localSrc : cdnSrc,
      cdn: cdnSrc,
    };
  }

  function createMissingCardItem(row) {
    var label = guessLabel(row);
    var route = normalizeRoute(row.detailRoute);
    var asset = assetForRow(row);

    var li = document.createElement('li');
    li.className = 'emoji emoji-panel-item';

    var card = document.createElement('article');
    card.className = 'panel-card panel-emoji-card';

    var link = document.createElement('a');
    link.className = 'panel-emoji-open';
    link.href = '/' + route;
    link.title = label;

    var title = document.createElement('span');
    title.className = 'panel-card-title panel-emoji-title';
    title.textContent = label;

    var hero = document.createElement('span');
    hero.className = 'panel-card-hero';
    hero.setAttribute('aria-hidden', 'true');

    var image = document.createElement('img');
    image.className = 'panel-card-hero-img';
    image.src = asset.src;
    image.alt = label;
    image.width = 56;
    image.height = 56;
    image.loading = 'lazy';
    image.setAttribute('data-cdn-src', asset.cdn);
    image.setAttribute('data-hex', String(row.hex || ''));

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'panel-emoji-copy';
    copy.setAttribute('data-copy-value', String(row.emoji || ''));
    copy.setAttribute('data-copy-label', label);
    copy.setAttribute('data-copy-format', 'emoji');
    copy.setAttribute('data-emoji', String(row.emoji || ''));
    copy.setAttribute('data-hex', String(row.hex || ''));
    copy.setAttribute('data-group', String(row.group || ''));
    copy.setAttribute('data-subgroup', String(row.subgroup || ''));
    copy.setAttribute('data-route', route);
    copy.setAttribute('aria-label', 'Copy ' + label + ' emoji');
    copy.title = 'Copy ' + label;

    var copyGlyph = document.createElement('span');
    copyGlyph.setAttribute('aria-hidden', 'true');
    copyGlyph.textContent = '⧉';

    var copyLabel = document.createElement('span');
    copyLabel.className = 'visually-hidden';
    copyLabel.textContent = 'Copy ' + label;

    hero.appendChild(image);
    link.appendChild(title);
    link.appendChild(hero);
    copy.appendChild(copyGlyph);
    copy.appendChild(copyLabel);
    card.appendChild(link);
    card.appendChild(copy);
    li.appendChild(card);

    return li;
  }

  function renderMissingList(missingRows, total) {
    var shell = document.querySelector('[data-tofu-missing-shell]');
    var list = document.querySelector('[data-tofu-missing-list]');
    var count = document.querySelector('[data-tofu-missing-count]');
    if (!shell || !list || !count) {
      return;
    }

    list.innerHTML = '';
    var safeTotal = Math.max(0, Number(total) || 0);
    var safeMissing = Array.isArray(missingRows) ? missingRows.length : 0;
    count.textContent =
      safeMissing.toLocaleString() +
      ' missing emoji ' +
      (safeTotal ? 'out of ' + safeTotal.toLocaleString() + ' scanned.' : 'detected.');

    if (!safeMissing) {
      var empty = document.createElement('li');
      empty.className = 'emoji-empty';
      empty.textContent = 'No missing glyphs detected on this system.';
      list.appendChild(empty);
      shell.hidden = false;
      return;
    }

    var fragment = document.createDocumentFragment();
    missingRows.forEach(function (row) {
      if (!row || !row.detailRoute || !row.hex) return;
      fragment.appendChild(createMissingCardItem(row));
    });
    list.appendChild(fragment);
    shell.hidden = false;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SCORE_VERSION) return null;
      if (parsed.userAgent !== navigator.userAgent) return null;
      if (!Number.isFinite(parsed.scannedAt)) return null;
      if (Date.now() - parsed.scannedAt > CACHE_MAX_AGE_MS) return null;
      if (!Number.isFinite(parsed.total) || !Number.isFinite(parsed.missing)) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(total, missing) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          version: SCORE_VERSION,
          userAgent: navigator.userAgent,
          scannedAt: Date.now(),
          total: total,
          missing: missing,
        })
      );
    } catch (_error) {
      // Ignore localStorage failures.
    }
  }

  function toPercent(value) {
    return Math.max(0, Math.min(100, value));
  }

  function formatDecimal(value) {
    if (!Number.isFinite(value)) return '0.0';
    return value.toFixed(1);
  }

  function applyToRoots(roots, updater) {
    roots.forEach(function (root) {
      updater(root);
    });
  }

  function setProgress(roots, percent) {
    var safe = toPercent(percent);
    applyToRoots(roots, function (root) {
      var bar = root.querySelector('[data-tofu-progress]');
      var label = root.querySelector('[data-tofu-progress-label]');
      if (bar) bar.value = safe;
      if (label) label.textContent = Math.round(safe) + '%';
    });
  }

  function setIndicator(roots, text) {
    applyToRoots(roots, function (root) {
      var node = root.querySelector('[data-tofu-indicator]');
      if (node) node.textContent = text;
    });
  }

  function setNote(roots, text) {
    applyToRoots(roots, function (root) {
      var node = root.querySelector('[data-tofu-note]');
      if (node) node.textContent = text;
    });
  }

  function setState(roots, stateName) {
    applyToRoots(roots, function (root) {
      root.classList.remove('is-scanning', 'is-supported', 'is-missing', 'is-error');
      root.classList.add(stateName);
    });
  }

  function setUserAgent() {
    var node = document.querySelector('[data-tofu-user-agent]');
    if (!node) return;
    node.textContent = 'Detected platform: ' + navigator.userAgent;
  }

  function renderSummary(roots, total, missing, fromCache) {
    var safeTotal = Math.max(1, Number(total) || 1);
    var safeMissing = Math.max(0, Number(missing) || 0);
    var supportedPercent = ((safeTotal - safeMissing) / safeTotal) * 100;
    var missingPercent = (safeMissing / safeTotal) * 100;

    setState(roots, safeMissing === 0 ? 'is-supported' : 'is-missing');
    setIndicator(
      roots,
      'Missing ' + safeMissing.toLocaleString() + ' of ' + safeTotal.toLocaleString()
    );
    setNote(
      roots,
      formatDecimal(supportedPercent) +
        '% supported · ' +
        formatDecimal(missingPercent) +
        '% tofu risk. Lower missing count is better.' +
        (fromCache ? ' (cached)' : '')
    );
    setProgress(roots, 100);
  }

  function fetchPool() {
    var inMemory = parsePool(window.__EMOJI_HOME_ROWS__);
    if (inMemory.length) {
      return Promise.resolve(inMemory);
    }

    function fetchRows(url) {
      return fetch(url).then(function (response) {
        if (!response.ok) throw new Error(url + ' unavailable');
        return response.json();
      });
    }

    return fetchRows('/tofu-data.json')
      .catch(function () {
        return fetchRows('/home-data.json');
      })
      .then(function (rows) {
        var pool = parsePool(rows);
        if (!pool.length) {
          throw new Error('empty-pool');
        }
        return pool;
      });
  }

  function runScoreScan(roots, options) {
    var opts = options || {};
    var force = Boolean(opts.force);
    var source = opts.source || 'unknown';
    var includeMissingList = Boolean(opts.includeMissingList);
    var detector = createEmojiSupportDetector();
    if (!detector) {
      setState(roots, 'is-error');
      setIndicator(roots, 'Tofu score unavailable');
      setNote(roots, 'Canvas emoji detection is unavailable in this browser.');
      setProgress(roots, 0);
      if (includeMissingList) {
        renderMissingList([], 0);
      }
      return Promise.resolve();
    }

    if (!force) {
      var cached = readCache();
      if (cached) {
        renderSummary(roots, cached.total, cached.missing, true);
        if (includeMissingList) {
          renderMissingList([], cached.total);
        }
        track('emoji_tofu_score_ready', {
          source: source,
          total: String(cached.total),
          missing: String(cached.missing),
          cache: 'hit',
        });
        return Promise.resolve();
      }
    }

    setState(roots, 'is-scanning');
    setIndicator(roots, 'Scanning emoji support…');
    setNote(roots, 'Running local tofu detection on the full emoji set.');
    setProgress(roots, 0);

    return fetchPool()
      .then(function (pool) {
        return new Promise(function (resolve) {
          var total = pool.length;
          var missing = 0;
          var index = 0;
          var missingRows = includeMissingList ? [] : null;

          function step(deadline) {
            var processed = 0;
            while (index < total) {
              if (
                processed > 20 &&
                deadline &&
                typeof deadline.timeRemaining === 'function' &&
                deadline.timeRemaining() < 4
              ) {
                break;
              }

              var row = pool[index];
              index += 1;
              processed += 1;

              if (!detector(row.emoji)) {
                missing += 1;
                if (missingRows) {
                  missingRows.push(row);
                }
              }

              if (processed >= 120) {
                break;
              }
            }

            setProgress(roots, (index / total) * 100);
            setIndicator(
              roots,
              'Scanning ' + index.toLocaleString() + ' / ' + total.toLocaleString()
            );

            if (index < total) {
              idle(step, 220);
              return;
            }

            writeCache(total, missing);
            renderSummary(roots, total, missing, false);
            if (includeMissingList) {
              renderMissingList(missingRows, total);
            }
            track('emoji_tofu_score_ready', {
              source: source,
              total: String(total),
              missing: String(missing),
              cache: 'miss',
            });
            resolve();
          }

          idle(step, 220);
        });
      })
      .catch(function () {
        setState(roots, 'is-error');
        setIndicator(roots, 'Tofu score unavailable');
        setNote(roots, 'Could not load emoji data for scoring on this visit.');
        setProgress(roots, 0);
        if (includeMissingList) {
          renderMissingList([], 0);
        }
      });
  }

  function initTofuDiagnostics() {
    var roots = Array.from(document.querySelectorAll('[data-tofu-score-root]'));
    if (!roots.length) {
      return;
    }

    var includeMissingList = roots.some(function (root) {
      return String(root.getAttribute('data-tofu-context') || '').toLowerCase() === 'tofu';
    });

    setUserAgent();

    var running = false;
    function safeRun(options) {
      if (running) {
        return;
      }
      running = true;
      var opts = options || {};
      runScoreScan(
        roots,
        Object.assign(
          {
            includeMissingList: includeMissingList,
          },
          opts
        )
      ).finally(function () {
        running = false;
      });
    }

    var rerunButton = document.querySelector('[data-tofu-rerun]');
    if (rerunButton) {
      rerunButton.addEventListener('click', function () {
        safeRun({ force: true, source: window.location.pathname });
      });
    }

    var hasStarted = false;
    function scheduleInitialRun(source) {
      if (hasStarted) return;
      hasStarted = true;
      window.setTimeout(function () {
        idle(function () {
          safeRun({
            force: includeMissingList ? true : false,
            source: source || window.location.pathname,
          });
        }, 260);
      }, 420);
    }

    if (document.body.classList.contains('page-home')) {
      var fallbackTimer = window.setTimeout(function () {
        scheduleInitialRun('home-fallback');
      }, 1800);

      document.addEventListener(
        'home:data-ready',
        function () {
          window.clearTimeout(fallbackTimer);
          scheduleInitialRun('home-ready');
        },
        { once: true }
      );
    } else {
      if (document.readyState === 'complete') {
        scheduleInitialRun('page-load');
      } else {
        window.addEventListener(
          'load',
          function () {
            scheduleInitialRun('page-load');
          },
          { once: true }
        );
      }
    }
  }

  initTofuDiagnostics();
})();
