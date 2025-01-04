const emojiList = document.getElementById('emoji-list');

// Fetch emoji data and render it
fetch('openmoji.json')
  .then((res) => res.json())
  .then((data) => {
    renderEmojis(data);
  })
  .catch((err) => console.error('Error loading emoji data:', err));

// Function to render emojis
function renderEmojis(emojis) {
  emojiList.innerHTML = emojis
    .map((emoji) => {
      if (!emoji.hexcode) {
        console.warn('Missing hexcode for emoji:', emoji);
        return '';
      }

      return `
          <div 
            class="emoji" 
            role="button" 
            tabindex="0" 
            title="${emoji.annotation}" 
            onclick="copyToClipboard('${emoji.emoji}')"
          >
            <img 
              src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(
                emoji.hexcode
              )}.svg" 
              alt="${emoji.annotation}" 
              loading="lazy" 
              style="width: 48px; height: 48px;"
            >
            <small>${emoji.annotation}</small>
          </div>
        `;
    })
    .join('');
}

// Copy emoji to clipboard
function copyToClipboard(emoji) {
  navigator.clipboard
    .writeText(emoji)
    .then(() => {
      showToast(`Copied: ${emoji}`);
    })
    .catch((err) => {
      console.error('Failed to copy emoji:', err);
    });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'toast';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 2000);
}

function formatHexcode(hexcode) {
  return hexcode.toUpperCase().replace(/\s/g, '-');
}
