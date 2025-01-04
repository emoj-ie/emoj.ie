const emojiList = document.getElementById('emoji-list');
const searchInput = document.getElementById('search');

let emojiData = []; // Store fetched emoji data

// Fetch emoji data and render initially
fetch('openmoji.json')
  .then((res) => res.json())
  .then((data) => {
    emojiData = data; // Store the data for filtering
    renderEmojis(emojiData); // Render all emojis initially
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

// Add event listener to the search input
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filteredEmojis = emojiData.filter((emoji) => {
    // Check if the query matches the annotation, tags, or hexcode
    return (
      emoji.annotation.toLowerCase().includes(query) ||
      (emoji.tags && emoji.tags.toLowerCase().includes(query)) ||
      emoji.hexcode.toLowerCase().includes(query)
    );
  });
  renderEmojis(filteredEmojis);
});
