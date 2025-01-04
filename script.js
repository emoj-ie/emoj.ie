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
      // Check if hexcode exists; log and skip invalid data
      if (!emoji.hexcode) {
        console.warn('Missing hexcode for emoji:', emoji);
        return '';
      }

      return `
        <div class="emoji" role="button" tabindex="0" title="${
          emoji.annotation
        }">
          <img 
            src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(
              emoji.hexcode
            )}.svg" 
            alt="${emoji.annotation}" 
            loading="lazy" 
            style="width: 48px; height: 48px;"
          >
        </div>
      `;
    })
    .join('');
}

function formatHexcode(hexcode) {
  return hexcode.toUpperCase().replace(/\s/g, '-');
}
