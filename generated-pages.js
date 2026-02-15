(function () {
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

  document.addEventListener('click', function (event) {
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
})();
