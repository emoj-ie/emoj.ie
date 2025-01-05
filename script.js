const emojiList = document.getElementById('emoji-list');
const searchInput = document.getElementById('search');
let firstLoad = true;
let emojiData = []; // Store fetched emoji data
const batchSize = 2; // Number of groups to load per batch
let currentBatch = 0;

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

function renderBatch(groupedEmojis) {
  const groupEntries = Object.entries(groupedEmojis); // Array of [group, subgroups]
  const start = currentBatch * batchSize;
  const end = start + batchSize;

  const batch = groupEntries.slice(start, end);

  const batchHTML = batch
    .map(([group, subgroups]) => {
      return `
        <div class="group">
          <h2>${group}</h2>
          <hr class="group-divider">
          ${Object.entries(subgroups)
            .map(([subgroup, emojis]) => {
              return `
                <div class="subgroup">
                  <h3>${subgroup}</h3>
                  <hr class="subgroup-divider">
                  <ul class="emoji-list">
                    ${emojis
                      .map((emoji) => {
                        return `
                          <li 
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
                            >
                            <small>${emoji.annotation}</small>
                          </li>
                        `;
                      })
                      .join('')}
                  </ul>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    })
    .join('');
  if (firstLoad) {
    emojiList.innerHTML = batchHTML;
    firstLoad = false;
  } else {
    // Append the batch to the existing content
    emojiList.insertAdjacentHTML('beforeend', batchHTML);
  }

  currentBatch++;

  // Remove loading placeholder if all groups are rendered
  if (currentBatch * batchSize >= groupEntries.length) {
    document.getElementById('loading-placeholder').remove();
  }
}

function setupLazyLoading(groupedEmojis) {
  const observer = new IntersectionObserver((entries) => {
    const lastEntry = entries[0];
    if (lastEntry.isIntersecting) {
      renderBatch(groupedEmojis);
      if (currentBatch * batchSize >= Object.keys(groupedEmojis).length) {
        observer.disconnect(); // Stop observing if all groups are loaded
      }
    }
  });

  // Add a loading placeholder
  const placeholder = document.createElement('div');
  placeholder.id = 'loading-placeholder';
  placeholder.className = 'loading-placeholder';
  placeholder.textContent = 'Loading more groups...';
  document.getElementById('emoji-list').appendChild(placeholder);

  observer.observe(placeholder);
}

function renderEmojis(emojis) {
  const groupedEmojis = groupEmojis(emojis); // Group emojis
  renderBatch(groupedEmojis); // Render initial batch
  setupLazyLoading(groupedEmojis); // Setup lazy loading
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

const backToTopButton = document.getElementById('back-to-top');

// Show or hide the button based on scroll position
window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    // Show button after scrolling 300px
    backToTopButton.classList.add('show');
    backToTopButton.classList.remove('hide');
  } else {
    backToTopButton.classList.add('hide');
    backToTopButton.classList.remove('show');
  }
});

// Scroll back to top when button is clicked
backToTopButton.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
});
