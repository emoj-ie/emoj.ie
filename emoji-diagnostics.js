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
      });
    });
    return pool;
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
    return fetch('/home-data.json')
      .then(function (response) {
        if (!response.ok) throw new Error('home-data unavailable');
        return response.json();
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
    var detector = createEmojiSupportDetector();
    if (!detector) {
      setState(roots, 'is-error');
      setIndicator(roots, 'Tofu score unavailable');
      setNote(roots, 'Canvas emoji detection is unavailable in this browser.');
      setProgress(roots, 0);
      return Promise.resolve();
    }

    if (!force) {
      var cached = readCache();
      if (cached) {
        renderSummary(roots, cached.total, cached.missing, true);
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
      });
  }

  function initTofuDiagnostics() {
    var roots = Array.from(document.querySelectorAll('[data-tofu-score-root]'));
    if (!roots.length) {
      return;
    }

    setUserAgent();

    var running = false;
    function safeRun(options) {
      if (running) {
        return;
      }
      running = true;
      runScoreScan(roots, options).finally(function () {
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
          safeRun({ force: false, source: source || window.location.pathname });
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
