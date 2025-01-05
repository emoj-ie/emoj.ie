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

// Function to group emojis by group and subgroup
function groupEmojis(emojis) {
  const grouped = {};

  emojis.forEach((emoji) => {
    if (!grouped[emoji.group]) {
      grouped[emoji.group] = {};
    }
    if (!grouped[emoji.group][emoji.subgroups]) {
      grouped[emoji.group][emoji.subgroups] = [];
    }
    grouped[emoji.group][emoji.subgroups].push(emoji);
  });

  return grouped;
}

// Function to render emojis by groups and subgroups
function renderEmojis(emojis) {
  const groupedEmojis = groupEmojis(emojis);
  emojiList.innerHTML = Object.entries(groupedEmojis)
    .map(([group, subgroups]) => {
      return `
          <div class="group">
            <h2>${group}</h2>
            <hr class="group-divider"> <!-- Divider for group -->
            ${Object.entries(subgroups)
              .map(([subgroup, emojis]) => {
                return `
                  <div class="subgroup">
                    <h3>${subgroup}</h3>
                    <hr class="subgroup-divider"> <!-- Divider for subgroup -->
                    <div class="emoji-grid">
                      ${emojis
                        .map((emoji) => {
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
                        .join('')}
                    </div>
                  </div>
                `;
              })
              .join('')}
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
