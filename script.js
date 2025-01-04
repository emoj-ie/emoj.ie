const emojiList = document.getElementById('emoji-list');

fetch('openmoji.json')
  .then((res) => res.json())
  .then((data) => {
    const emojis = data.map((emoji) => ({
      char: emoji.hexcode, // Use hexcode for SVG
      name: emoji.annotation,
      category: emoji.group,
    }));
    renderEmojis(emojis);
  });

function renderEmojis(emojis) {
  emojiList.innerHTML = emojis
    .map(
      (emoji) => `
      <div class="emoji" role="button" tabindex="0" title="${emoji.annotation}">
        <img 
          src="https://cdn.jsdelivr.net/npm/@openmoji/svg@14.0.0/color/${emoji.hexcode}.svg" 
          alt="${emoji.annotation}" 
          loading="lazy"
          style="width: 48px; height: 48px;"
        >
        <small>${emoji.annotation}</small>
      </div>
    `
    )
    .join('');
}
