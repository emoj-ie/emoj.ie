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
              src="https://cdn.jsdelivr.net/npm/@openmoji/svg@14.0.0/svg/${emoji.hexcode}.svg" 
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
      alert(`Copied: ${emoji}`);
    })
    .catch((err) => {
      console.error('Failed to copy emoji:', err);
    });
}

function formatHexcode(hexcode) {
  return hexcode.toUpperCase().replace(/\s/g, '-');
}
