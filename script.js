const searchInput = document.getElementById('search');
const emojiList = document.getElementById('emoji-list');

fetch('emoji-data.json')
  .then((res) => res.json())
  .then((data) => {
    const emojis = data;
    renderEmojis(emojis);

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const filtered = emojis.filter(({ name, category }) =>
        `${name} ${category}`.toLowerCase().includes(query)
      );
      renderEmojis(filtered);
    });
  });

function renderEmojis(emojis) {
  emojiList.innerHTML = emojis
    .map(
      (emoji) => `
      <div class="emoji" role="button" tabindex="0" title="${emoji.name}">
        <div style="font-size: 2rem;">${emoji.char}</div>
        <small>${emoji.name}</small>
      </div>
    `
    )
    .join('');
}
