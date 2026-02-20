(function () {
  function track(eventName, props) {
    if (typeof window.plausible !== 'function') {
      return;
    }

    window.plausible(eventName, { props: props || {} });
  }

  function createEmojiGlyphDetector() {
    var canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 72;

    var context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    var fontFamily =
      '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
    var probeGlyphs = [
      String.fromCodePoint(0x10fffd),
      String.fromCodePoint(0xf0000),
      String.fromCodePoint(0xf0001),
      '\ufffd',
    ];

    function getSignature(glyph) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = '56px ' + fontFamily;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#000000';
      context.fillText(glyph, canvas.width / 2, canvas.height / 2 + 2);

      var imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      var minX = canvas.width;
      var minY = canvas.height;
      var maxX = -1;
      var maxY = -1;
      var painted = 0;
      var hash = 2166136261;

      for (var y = 0; y < canvas.height; y += 1) {
        for (var x = 0; x < canvas.width; x += 1) {
          var offset = (y * canvas.width + x) * 4;
          var alpha = imageData[offset + 3];
          if (alpha === 0) {
            continue;
          }

          painted += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;

          hash ^= imageData[offset];
          hash = Math.imul(hash, 16777619);
          hash ^= imageData[offset + 1];
          hash = Math.imul(hash, 16777619);
          hash ^= imageData[offset + 2];
          hash = Math.imul(hash, 16777619);
          hash ^= alpha;
          hash = Math.imul(hash, 16777619);
        }
      }

      if (!painted || maxX < minX || maxY < minY) {
        return null;
      }

      var boxWidth = maxX - minX + 1;
      var boxHeight = maxY - minY + 1;
      var normalizedHash = (hash >>> 0).toString(16);
      return boxWidth + 'x' + boxHeight + ':' + painted + ':' + normalizedHash;
    }

    var probeSignatures = probeGlyphs
      .map(function (glyph) {
        return getSignature(glyph);
      })
      .filter(Boolean);

    function detect(glyph) {
      var signature = getSignature(glyph);
      if (!signature) {
        return { supported: false, reason: 'empty' };
      }

      if (probeSignatures.indexOf(signature) !== -1) {
        return { supported: false, reason: 'tofu-match' };
      }

      return { supported: true, reason: 'ok' };
    }

    return { detect: detect };
  }

  function initEmojiRenderDiagnostics() {
    if (!document.body.classList.contains('page-detail')) {
      return;
    }

    var emojiCard = document.querySelector('[data-emoji-render-status]');
    if (!emojiCard) {
      return;
    }

    var emojiGlyph = emojiCard.getAttribute('data-emoji') || '';
    var emojiHex = emojiCard.getAttribute('data-hex') || '';
    var indicatorNode = emojiCard.querySelector('[data-emoji-render-indicator]');
    var noteNode = emojiCard.querySelector('[data-emoji-render-note]');

    function setCardState(card, state) {
      if (!card) return;
      card.classList.remove('is-supported', 'is-missing', 'is-scanning', 'is-error');
      card.classList.add(state);
    }

    function setText(node, text) {
      if (node) {
        node.textContent = text;
      }
    }

    function formatPercent(value) {
      if (!Number.isFinite(value)) return '0.0';
      return value.toFixed(1);
    }

    var detector = createEmojiGlyphDetector();
    if (!detector) {
      setCardState(emojiCard, 'is-error');
      setText(indicatorNode, 'Render check unavailable');
      setText(noteNode, 'Canvas render diagnostics are unavailable in this browser.');
      return;
    }

    setCardState(emojiCard, 'is-scanning');
    var currentResult = detector.detect(emojiGlyph);
    if (currentResult.supported) {
      setCardState(emojiCard, 'is-supported');
      setText(indicatorNode, 'Supported on this system');
      setText(noteNode, 'Your platform appears to render this emoji natively.');
    } else {
      setCardState(emojiCard, 'is-missing');
      setText(indicatorNode, 'Likely tofu on this system');
      setText(noteNode, 'This glyph may show as a missing-character box on this device.');
    }

    track('emoji_render_check', {
      source: window.location.pathname,
      hex: emojiHex,
      supported: currentResult.supported ? 'yes' : 'no',
      reason: currentResult.reason || '',
    });

    var scoreCard = document.querySelector('[data-system-tofu-score]');
    if (!scoreCard) {
      return;
    }

    var scoreIndicatorNode = scoreCard.querySelector('[data-system-tofu-indicator]');
    var scoreNoteNode = scoreCard.querySelector('[data-system-tofu-note]');
    var scoreProgressNode = scoreCard.querySelector('[data-system-tofu-progress]');
    var scoreProgressLabelNode = scoreCard.querySelector('[data-system-tofu-progress-label]');

    var CACHE_KEY = 'emojiTofuScoreV2';
    var CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

    function setProgress(percent) {
      if (scoreProgressNode) {
        scoreProgressNode.value = Math.max(0, Math.min(100, percent));
      }
      if (scoreProgressLabelNode) {
        scoreProgressLabelNode.textContent = Math.round(Math.max(0, Math.min(100, percent))) + '%';
      }
    }

    function renderScanSummary(total, missing, fromCache) {
      var safeTotal = Math.max(1, Number(total) || 1);
      var safeMissing = Math.max(0, Number(missing) || 0);
      var missingRatio = safeMissing / safeTotal;
      var supportedRatio = Math.max(0, 1 - missingRatio);
      var supportPercent = formatPercent(supportedRatio * 100);
      var missingPercent = formatPercent(missingRatio * 100);

      setCardState(scoreCard, safeMissing === 0 ? 'is-supported' : 'is-missing');
      setText(
        scoreIndicatorNode,
        'Missing ' + safeMissing.toLocaleString() + ' of ' + safeTotal.toLocaleString()
      );
      setText(
        scoreNoteNode,
        supportPercent +
          '% supported · ' +
          missingPercent +
          '% tofu risk. Lower missing count is better.' +
          (fromCache ? ' (cached)' : '')
      );
      setProgress(100);
    }

    function readCachedScore() {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 2) return null;
        if (parsed.userAgent !== navigator.userAgent) return null;
        if (!Number.isFinite(parsed.scannedAt) || Date.now() - parsed.scannedAt > CACHE_MAX_AGE_MS) {
          return null;
        }
        if (!Number.isFinite(parsed.total) || !Number.isFinite(parsed.missing)) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    }

    function writeCachedScore(total, missing) {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            version: 2,
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

    var cached = readCachedScore();
    if (cached) {
      renderScanSummary(cached.total, cached.missing, true);
      track('emoji_tofu_score_ready', {
        source: window.location.pathname,
        total: String(cached.total),
        missing: String(cached.missing),
        cache: 'hit',
      });
      return;
    }

    setCardState(scoreCard, 'is-scanning');
    setText(scoreIndicatorNode, 'Scanning emoji support…');
    setText(scoreNoteNode, 'Running a local render check across the emoji set.');
    setProgress(0);

    fetch('/home-data.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('home data unavailable');
        }
        return response.json();
      })
      .then(function (rows) {
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

        if (!pool.length) {
          throw new Error('emoji pool unavailable');
        }

        var total = pool.length;
        var missing = 0;
        var index = 0;
        var idle =
          window.requestIdleCallback ||
          function (callback) {
            return window.setTimeout(function () {
              callback({
                timeRemaining: function () {
                  return 0;
                },
              });
            }, 16);
          };

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

            var result = detector.detect(row.emoji);
            if (!result.supported) {
              missing += 1;
            }

            if (processed >= 90) {
              break;
            }
          }

          var progress = (index / total) * 100;
          setProgress(progress);
          setText(
            scoreIndicatorNode,
            'Scanning ' + index.toLocaleString() + ' / ' + total.toLocaleString()
          );

          if (index < total) {
            idle(step, { timeout: 180 });
            return;
          }

          writeCachedScore(total, missing);
          renderScanSummary(total, missing, false);
          track('emoji_tofu_score_ready', {
            source: window.location.pathname,
            total: String(total),
            missing: String(missing),
            cache: 'miss',
          });
        }

        idle(step, { timeout: 180 });
      })
      .catch(function () {
        setCardState(scoreCard, 'is-error');
        setText(scoreIndicatorNode, 'Tofu score unavailable');
        setText(scoreNoteNode, 'Could not load emoji dataset for scoring on this visit.');
        setProgress(0);
      });
  }

  initEmojiRenderDiagnostics();
})();
