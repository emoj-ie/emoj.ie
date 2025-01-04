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
    .map(
      (emoji) => `
      <div class="emoji" role="button" tabindex="0" title="${emoji.annotation}">
        <img 
          src="https://cdn.jsdelivr.net/npm/@openmoji@14.0.0/color/svg/${
            emoji.hexcode
          }.svg" 
          alt="${emoji.annotation}" 
          loading="lazy" 
          style="width: 48px; height: 48px;"
        >
        <small>${emoji.annotation}</small>
        <p>${emoji.tags ? emoji.tags : ''}</p>
      </div>
    `
    )
    .join('');
}
