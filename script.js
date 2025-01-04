const emojiList = document.getElementById('emoji-list');

fetch('emoji-data.json')
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
      <div class="emoji" role="button" tabindex="0" title="${emoji.name}">
        <img 
          src="https://cdn.jsdelivr.net/npm/@openmoji/svg@14.0.0/color/${emoji.char}.svg" 
          alt="${emoji.name}" 
          loading="lazy"
          style="width: 48px; height: 48px;"
        >
        <small>${emoji.name}</small>
      </div>
    `
    )
    .join('');
}
