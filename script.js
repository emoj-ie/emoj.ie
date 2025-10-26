const emojiList = document.getElementById('emoji-list');
const searchInput = document.getElementById('search');
let firstLoad = true;
let emojiData = []; // Store fetched emoji data
const batchSize = 2; // Number of groups to load per batch
let currentBatch = 0;

// Adjust the relative path based on the current location
const jsonPath = new URL('grouped-openmoji.json', window.location.origin).href;

// Filter elements
const groupFilter = document.getElementById('group-filter');
const subgroupFilter = document.getElementById('subgroup-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');

// Menu toggle
const menuToggle = document.getElementById('menu-toggle');
const headerMenu = document.getElementById('header-menu');

// Recently used emojis
const recentEmojisSection = document.getElementById('recent-emojis');
const recentEmojisGrid = document.querySelector('.recent-emojis-grid');
const carouselPrev = document.querySelector('.carousel-prev');
const carouselNext = document.querySelector('.carousel-next');
const recentCarousel = document.querySelector('.recent-carousel');
let recentEmojis = JSON.parse(localStorage.getItem('recentEmojis')) || [];

// Clean up recent emojis - remove any entries without hexcodes
recentEmojis = recentEmojis.filter(emoji => emoji && emoji.hexcode);

// Modal elements
const modal = document.getElementById('emoji-modal');
const modalClose = document.getElementById('modal-close');
const modalEmojiImg = document.getElementById('modal-emoji-img');
const modalEmojiName = document.getElementById('modal-emoji-name');
const modalUnicode = document.getElementById('modal-unicode');
const modalHexcode = document.getElementById('modal-hexcode');
const modalGroup = document.getElementById('modal-group');
const modalSubgroup = document.getElementById('modal-subgroup');
const modalTags = document.getElementById('modal-tags');
const modalTagsSection = document.getElementById('modal-tags-section');
const modalCopyBtn = document.getElementById('modal-copy-btn');
const modalCopyUnicodeBtn = document.getElementById('modal-copy-unicode-btn');

// Modal functions
function showEmojiModal(emoji) {
  // Set modal content
  const emojiUrl = `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(emoji.hexcode)}.svg`;
  modalEmojiImg.src = emojiUrl;
  modalEmojiImg.alt = emoji.annotation;
  
  modalEmojiName.textContent = emoji.annotation;
  modalUnicode.textContent = `U+${emoji.hexcode}`;
  modalHexcode.textContent = emoji.hexcode;
  modalGroup.textContent = emoji.group.replace(/-/g, ' ');
  modalSubgroup.textContent = emoji.subgroups.replace(/-/g, ' ');
  
  // Handle tags
  if (emoji.tags) {
    modalTags.textContent = emoji.tags;
    modalTagsSection.style.display = 'block';
  } else {
    modalTagsSection.style.display = 'none';
  }
  
  // Store emoji data for copy buttons
  modalCopyBtn.emojiData = emoji;
  modalCopyUnicodeBtn.emojiData = emoji;
  
  // Show modal
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function hideEmojiModal() {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling
}

// Modal event listeners
modalClose.addEventListener('click', hideEmojiModal);

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    hideEmojiModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'block') {
    hideEmojiModal();
  }
});

// Modal copy buttons
modalCopyBtn.addEventListener('click', function() {
  copyToClipboard(this.emojiData.emoji);
  addToRecent(this.emojiData);
  hideEmojiModal(); // Close modal after copying
});

modalCopyUnicodeBtn.addEventListener('click', function() {
  copyToClipboard(this.emojiData.hexcode);
  addToRecent(this.emojiData);
  hideEmojiModal(); // Close modal after copying
});

// Theme management functions
function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme() {
  return localStorage.getItem('theme');
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update toggle button icon
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function initializeTheme() {
  const storedTheme = getStoredTheme();
  const systemTheme = getSystemTheme();
  const initialTheme = storedTheme || systemTheme;
  
  setTheme(initialTheme);
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if no stored preference
      if (!getStoredTheme()) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Theme toggle event listener
themeToggle.addEventListener('click', toggleTheme);

// Menu toggle event listener
menuToggle.addEventListener('click', toggleMenu);

// Menu toggle function
function toggleMenu() {
  const isOpen = headerMenu.classList.contains('open');
  menuToggle.classList.toggle('active', !isOpen);
  headerMenu.classList.toggle('open', !isOpen);
  
  // Close menu when clicking outside
  if (!isOpen) {
    document.addEventListener('click', closeMenuOnClickOutside);
  } else {
    document.removeEventListener('click', closeMenuOnClickOutside);
  }
}

function closeMenuOnClickOutside(event) {
  if (!headerMenu.contains(event.target) && !menuToggle.contains(event.target)) {
    toggleMenu();
  }
}

// Recently used emojis functions
function addToRecent(emojiData) {
  // Remove if already exists
  recentEmojis = recentEmojis.filter(item => item.emoji !== emojiData.emoji);
  
  // Add to beginning
  recentEmojis.unshift(emojiData);
  
  // Keep only last 20
  recentEmojis = recentEmojis.slice(0, 20);
  
  // Clean up recent emojis - remove any entries without hexcodes
  recentEmojis = recentEmojis.filter(emoji => emoji && emoji.hexcode);
  
  // Save to localStorage
  localStorage.setItem('recentEmojis', JSON.stringify(recentEmojis));
  
  // Update display
  updateRecentEmojis();
}

function updateRecentEmojis() {
  if (recentEmojis.length === 0) {
    recentEmojisSection.style.display = 'none';
    return;
  }
  
  recentEmojisSection.style.display = 'block';
  recentEmojisGrid.innerHTML = '';
  
  recentEmojis.forEach(emojiData => {
    // Skip emojis without valid hexcode
    if (!emojiData.hexcode) {
      console.warn('Skipping emoji without hexcode:', emojiData);
      return;
    }
    
    const emojiElement = document.createElement('li');
    emojiElement.className = 'emoji';
    emojiElement.innerHTML = `
      <img 
        src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(emojiData.hexcode)}.svg" 
        alt="${emojiData.annotation}" 
        loading="lazy"
        onclick="showEmojiModal({emoji: '${emojiData.emoji}', hexcode: '${emojiData.hexcode}', annotation: '${emojiData.annotation.replace(/'/g, "\\'")}', group: '${emojiData.group}', subgroups: '${emojiData.subgroups}', tags: '${emojiData.tags || ''}'})"
      >
      <hr/>
      <a href="/${emojiData.group}/${emojiData.subgroups}/${sanitizeAnnotation(emojiData.annotation).replaceAll('--', '-')}">
        <small>${sanitizeAnnotation(emojiData.annotation).replaceAll('-', ' ')}</small>
      </a>
    `;
    recentEmojisGrid.appendChild(emojiElement);
  });
  
  // Update carousel navigation
  updateCarouselNavigation();
}

function updateCarouselNavigation() {
  const scrollLeft = recentCarousel.scrollLeft;
  const scrollWidth = recentCarousel.scrollWidth;
  const clientWidth = recentCarousel.clientWidth;
  
  // Show/hide navigation buttons based on scroll position
  carouselPrev.style.display = scrollLeft > 0 ? 'flex' : 'none';
  carouselNext.style.display = scrollLeft < scrollWidth - clientWidth - 1 ? 'flex' : 'none';
}

function scrollCarousel(direction) {
  const emojiWidth = 56 + 12; // emoji width + gap
  const scrollAmount = emojiWidth * 3; // Scroll 3 emojis at a time
  
  recentCarousel.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
}

// Carousel event listeners
carouselPrev.addEventListener('click', () => scrollCarousel(-1));
carouselNext.addEventListener('click', () => scrollCarousel(1));

// Update navigation on scroll
recentCarousel.addEventListener('scroll', updateCarouselNavigation);

// Filter functions
function populateGroupFilter() {
  const groups = Object.keys(emojiData).sort();
  groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group.replace(/-/g, ' ');
    groupFilter.appendChild(option);
  });
}

function populateSubgroupFilter(group) {
  subgroupFilter.innerHTML = '<option value="">All Subcategories</option>';
  
  if (group && emojiData[group]) {
    const subgroups = Object.keys(emojiData[group]).sort();
    subgroups.forEach(subgroup => {
      const option = document.createElement('option');
      option.value = subgroup;
      option.textContent = subgroup.replace(/-/g, ' ');
      subgroupFilter.appendChild(option);
    });
    subgroupFilter.disabled = false;
  } else {
    subgroupFilter.disabled = true;
  }
}

function applyFilters() {
  const selectedGroup = groupFilter.value;
  const selectedSubgroup = subgroupFilter.value;
  const searchQuery = searchInput.value.toLowerCase().trim();
  
  let filteredData = {};
  
  if (!selectedGroup) {
    // No filters - use all data
    filteredData = emojiData;
  } else if (selectedSubgroup) {
    // Filter by both group and subgroup
    if (emojiData[selectedGroup] && emojiData[selectedGroup][selectedSubgroup]) {
      filteredData[selectedGroup] = {};
      filteredData[selectedGroup][selectedSubgroup] = emojiData[selectedGroup][selectedSubgroup];
    }
  } else {
    // Filter by group only
    filteredData[selectedGroup] = emojiData[selectedGroup];
  }
  
  // If there's a search query, apply it to the filtered data
  if (searchQuery) {
    const searchResults = {};
    Object.entries(filteredData).forEach(([group, subgroups]) => {
      Object.entries(subgroups).forEach(([subgroup, emojis]) => {
        const filtered = emojis.filter(
          (emoji) =>
            emoji.annotation.toLowerCase().includes(searchQuery) ||
            (emoji.tags && emoji.tags.toLowerCase().includes(searchQuery))
        );
        if (filtered.length > 0) {
          if (!searchResults[group]) searchResults[group] = {};
          searchResults[group][subgroup] = filtered;
        }
      });
    });
    renderEmojis(searchResults, true);
  } else {
    renderEmojis(filteredData, false);
  }
}

// Filter event listeners
groupFilter.addEventListener('change', function() {
  populateSubgroupFilter(this.value);
  applyFilters();
});

subgroupFilter.addEventListener('change', applyFilters);

clearFiltersBtn.addEventListener('click', function() {
  groupFilter.value = '';
  subgroupFilter.value = '';
  subgroupFilter.disabled = true;
  searchInput.value = '';
  applyFilters();
});

// Fetch emoji data and render initially
fetch(jsonPath)
  .then((res) => res.json())
  .then((data) => {
    emojiData = data; // Store the grouped data directly
    populateGroupFilter(); // Populate group filter dropdown
    renderBatch(emojiData); // Render initial emojis in batches
    setupLazyLoading(emojiData); // Setup lazy loading
    updateRecentEmojis(); // Show recently used emojis if any
    initializeTheme(); // Initialize theme on page load
  })
  .catch((err) => console.error('Error loading emoji data:', err));

// Function to group emojis by group and subgroup
// function groupEmojis(emojis) {
//   const grouped = {};

//   emojis.forEach((emoji) => {
//     if (!grouped[emoji.group]) {
//       grouped[emoji.group] = {};
//     }
//     if (!grouped[emoji.group][emoji.subgroups]) {
//       grouped[emoji.group][emoji.subgroups] = [];
//     }
//     grouped[emoji.group][emoji.subgroups].push(emoji);
//   });

//   return grouped;
// }

// Helper function to sanitize annotation for folder names
function sanitizeAnnotation(annotation) {
  return annotation
    .replaceAll(/[&,<>:"/\\|?*\s]/g, '-')
    .toLowerCase()
    .replaceAll('--', '-');
}

function renderBatch(groupedEmojis, renderAll = false) {
  const groupEntries = Object.entries(groupedEmojis); // Array of [group, subgroups]
  const start = currentBatch * batchSize;
  const end = renderAll ? groupEntries.length : start + batchSize;

  const batch = groupEntries.slice(start, end);

  const batchHTML = batch
    .map(([group, subgroups]) => {
      return `
        <div class="group">
          <a href="./${group}">
            <h2>${group.replaceAll('-', ' ')}</h2>
          </a>
          <p>${generateGroupContent(group)}</p>
          <hr class="group-divider">
          ${Object.entries(subgroups)
            .map(([subgroup, emojis]) => {
              return `
                <div class="subgroup">
                  <a href="./${group}/${subgroup}">
                    <h3>${subgroup.replaceAll('-', ' ')}</h3>
                  </a>
                  <p>${generateSubgroupContent(subgroup)}</p>
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
                          >
                            <img 
                              src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(
                                emoji.hexcode
                              )}.svg" 
                              alt="${emoji.annotation}" 
                              loading="lazy"
                              onclick="showEmojiModal({emoji: '${emoji.emoji}', hexcode: '${emoji.hexcode}', annotation: '${emoji.annotation.replace(/'/g, "\\'")}', group: '${emoji.group}', subgroups: '${emoji.subgroups}', tags: '${emoji.tags || ''}'})"
                            >
                            <hr/>
                            <a href="/${group}/${subgroup}/${sanitizeAnnotation(emoji.annotation).replaceAll('--', '-')}">
                              <small>${sanitizeAnnotation(
                                emoji.annotation
                              ).replaceAll('-', ' ')}</small>
                            </a>
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
  if (firstLoad || renderAll) {
    emojiList.innerHTML = batchHTML;
    firstLoad = false;
  } else {
    emojiList.insertAdjacentHTML('beforeend', batchHTML); // Append new batch
  }

  currentBatch++;

  // Remove loading placeholder if all groups are rendered
  if (currentBatch * batchSize >= groupEntries.length) {
    const placeholder = document.getElementById('loading-placeholder');
    if (placeholder) placeholder.remove();
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

  // Remove existing placeholder if any
  const existingPlaceholder = document.getElementById('loading-placeholder');
  if (existingPlaceholder) existingPlaceholder.remove();

  // Add a new loading placeholder
  const placeholder = document.createElement('div');
  placeholder.id = 'loading-placeholder';
  placeholder.className = 'loading-placeholder';
  placeholder.textContent = 'Loading more groups...';
  emojiList.appendChild(placeholder);

  observer.observe(placeholder);
}

function renderEmojis(emojis, isSearch = false) {
  currentBatch = 0; // Reset batch index when rendering fresh data

  if (isSearch) {
    emojiList.innerHTML = ''; // Clear all current content
    firstLoad = false; // Avoid reinitializing first load behavior
    renderBatch(emojis, true); // Render everything for search results
  } else {
    emojiList.innerHTML = ''; // Clear existing content for a fresh render
    firstLoad = true;
    renderBatch(emojis); // Render initial batch for normal flow
    setupLazyLoading(emojis); // Reinitialize lazy loading
  }
}

// Copy emoji to clipboard
function copyToClipboard(emoji) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(emoji)
      .then(() => {
        showToast(`Copied: ${emoji}`);
      })
      .catch((err) => {
        console.error('Failed to copy emoji:', err);
      });
  } else {
    // Fallback for older browsers or insecure contexts
    const tempInput = document.createElement('input');
    tempInput.value = emoji;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast(`Copied: ${emoji}`);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(tempInput);
  }
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
  if (!hexcode) {
    console.warn('formatHexcode: hexcode is undefined or null');
    return '';
  }
  return hexcode.toUpperCase().replaceAll(/\s/g, '-');
}

function generateGroupContent(group) {
  const content = {
    'smileys-emotion':
      'This category includes smileys and emotions that represent feelings and expressions.',
    'people-body': 'Emojis representing people, gestures, and body parts.',
    'animals-nature':
      'Emojis of animals, plants, and other elements of nature.',
    'food-drink':
      'Food and drink emojis for representing meals, beverages, and utensils.',
    'travel-places': 'Travel, places, and transportation-themed emojis.',
    activities: 'Sports, hobbies, and activity-related emojis.',
    objects: 'Various objects and tools from daily life.',
    symbols: 'Symbols representing signs, arrows, and other symbolic content.',
    flags: 'Flags from around the world and other geographic regions.',
    component: 'Emoji components such as skin tones and hairstyles.',
    'extras-openmoji': 'Unique emojis contributed by the OpenMoji community.',
    'extras-unicode': 'Unicode extras like regional indicators and symbols.',
  };
  return content[group] || 'Explore emojis in this category.';
}

function generateSubgroupContent(subgroup) {
  const content = {
    'face-smiling':
      'Smiling faces that convey happiness, excitement, friendliness, and joy.',
    'face-affection':
      'Faces expressing affection, including love, kisses, and hugs.',
    'face-tongue':
      'Playful faces sticking out their tongues or making silly expressions.',
    'face-hand':
      'Faces interacting with hands, such as facepalms, salutes, or gestures.',
    'face-neutral-skeptical':
      'Neutral or skeptical faces, showing ambivalence, doubt, or disapproval.',
    'face-sleepy':
      'Tired or sleepy faces, including yawning and snoring expressions.',
    'face-unwell':
      'Faces indicating sickness, pain, or other forms of discomfort.',
    'face-hat': 'Faces wearing hats, including party hats and cowboy hats.',
    'face-glasses':
      'Faces with glasses, ranging from nerdy looks to cool sunglasses.',
    'face-concerned': 'Concerned faces displaying worry, sadness, or fear.',
    'face-negative':
      'Faces showing negative emotions like anger, frustration, or despair.',
    'face-costume':
      'Faces dressed up in costumes, including clowns and disguised looks.',
    'cat-face': 'Cat faces expressing emotions like joy, sadness, or mischief.',
    'monkey-face': 'Monkey faces, including playful and shy expressions.',
    heart: 'Heart emojis representing love, affection, or heartbreak.',
    emotion: 'Emojis representing emotions like joy, sorrow, and frustration.',
    'hand-fingers-open':
      'Open hand gestures like waving, high-fives, and raised hands.',
    'hand-fingers-partial':
      'Partial hand gestures, such as pinching and holding fingers together.',
    'hand-single-finger':
      'Single-finger gestures, including pointing and thumbs-up.',
    'hand-fingers-closed': 'Closed hand gestures, like fists or handshakes.',
    hands:
      'Hand emojis showing interactions, such as clapping and folding hands.',
    'hand-prop':
      'Hands holding or interacting with objects, like writing or raising a drink.',
    'body-parts': 'Various body parts, such as ears, noses, and legs.',
    person: 'Generic person emojis representing people in different contexts.',
    'person-gesture':
      'People making gestures, such as shrugging, bowing, or facepalming.',
    'person-role':
      'People in professional roles, such as teachers, doctors, or chefs.',
    'person-fantasy':
      'Fantasy-themed people, such as fairies, mermaids, and wizards.',
    'person-activity':
      'People engaging in various activities like dancing or working out.',
    'person-sport': 'Sport-themed people, including athletes and coaches.',
    'person-resting':
      'People in relaxed positions, like sitting or lying down.',
    family:
      'Couples, hand-holding, kissing & family units of various compositions.',
    'person-symbol':
      'Symbolic people icons, including gender symbols and restroom signs.',
    'skin-tone':
      'Skin tone modifiers to customize emojis to represent diverse appearances.',
    'hair-style':
      'Hair styles and colors for customizing the appearance of emojis.',
    'animal-mammal':
      'Mammals like dogs, cats, and wild animals such as lions and tigers.',
    'animal-bird': 'Birds from pigeons to majestic eagles.',
    'animal-amphibian': 'Amphibians like frogs and salamanders.',
    'animal-reptile': 'Reptiles, including turtles, snakes, and lizards.',
    'animal-marine': 'Marine animals such as fish, dolphins, and whales.',
    'animal-bug': 'Bugs and insects like butterflies, bees, and spiders.',
    'plant-flower': 'Flowers and plants, such as roses, tulips, and cacti.',
    'plant-other':
      'Other plants and trees, such as potted plants and evergreens.',
    'food-fruit':
      'Fresh fruits like apples, bananas, cherries, and strawberries.',
    'food-vegetable': 'Vegetables such as carrots, broccoli, and corn.',
    'food-prepared': 'Prepared meals, including pizzas, sandwiches, and stews.',
    'food-asian': 'Asian cuisine, such as sushi, dumplings, and rice bowls.',
    'food-marine': 'Seafood dishes, including shrimp and oysters.',
    'food-sweet': 'Sweet treats like cakes, ice creams, and candies.',
    drink: 'Beverages such as coffee, tea, and cocktails.',
    dishware: 'Dishware items, including plates, bowls, and utensils.',
    'place-map': 'Map symbols like globes and compass icons.',
    'place-geographic':
      'Geographic places such as mountains, deserts, and islands.',
    'place-building': 'Buildings, including homes, offices, and castles.',
    'place-religious':
      'Religious structures like churches, mosques, and temples.',
    'place-other': 'Miscellaneous places, including parks and landmarks.',
    'transport-ground': 'Ground transportation like cars, buses, and trains.',
    'transport-water': 'Water transportation like boats, ferries, and canoes.',
    'transport-air':
      'Air transportation, including airplanes, rockets, and helicopters.',
    hotel: 'Hotels and accommodations for travelers.',
    time: 'Time-related emojis such as clocks and hourglasses.',
    'sky-weather':
      'Sky and weather elements, including the sun, rain, and snow.',
    event: 'Event-related emojis like balloons, fireworks, and party poppers.',
    'award-medal': 'Awards and medals for achievements, including trophies.',
    sport:
      'Sports equipment and activities like basketball, soccer, and tennis.',
    game: 'Games and recreational activities, including cards and dice.',
    'arts-crafts':
      'Artistic tools and crafts, like paint palettes and scissors.',
    clothing: 'Clothing items like shirts, hats, and shoes.',
    sound: 'Sound-related objects like speakers, headphones, and bells.',
    music: 'Music symbols and instruments, including notes and microphones.',
    'musical-instrument':
      'Musical instruments like guitars, pianos, and trumpets.',
    phone: 'Phone-related devices such as mobile phones and landlines.',
    computer: 'Computers, tablets, and other tech devices.',
    'light-video': 'Lighting and video equipment, like lamps and cameras.',
    'book-paper': 'Books, papers, and other reading materials.',
    money: 'Money-related emojis, including coins, bills, and bags of cash.',
    mail: 'Mail and communication symbols, including envelopes.',
    writing: 'Writing tools like pens, pencils, and notebooks.',
    office: 'Office supplies such as briefcases and clipboards.',
    lock: 'Locks, keys, and security-related symbols.',
    tool: 'Tools like hammers, wrenches, and screwdrivers.',
    science: 'Science-related objects, such as microscopes and test tubes.',
    medical: 'Medical tools and symbols like syringes and pills.',
    household: 'Household objects like furniture and appliances.',
    'other-object': "Miscellaneous objects that don't fit other categories.",
    'transport-sign':
      'Signs related to transportation, including road signs and signals.',
    warning: 'Warning symbols, such as exclamation marks and hazard signs.',
    arrow: 'Arrow symbols pointing in various directions.',
    religion: 'Religious symbols representing different faiths and beliefs.',
    zodiac: 'Zodiac signs based on astrology.',
    'av-symbol':
      'Audio and video symbols, such as play, pause, and stop icons.',
    gender:
      'Gender symbols representing male, female, and gender-neutral options.',
    math: 'Mathematical symbols, including plus, minus, and multiplication signs.',
    punctuation:
      'Punctuation marks, such as question marks and exclamation points.',
    currency: 'Currency symbols like dollar, euro, and yen.',
    'other-symbol': "Miscellaneous symbols that don't fit other categories.",
    keycap: 'Keycap emojis for numbers and symbols.',
    alphanum: 'Alphanumeric symbols, including letters and numbers.',
    geometric: 'Geometric shapes, such as circles, squares, and triangles.',
    flag: 'General flag emojis representing symbolic flags.',
    'country-flag': 'Country flags from around the world.',
    'subdivision-flag': 'Flags representing regions, states, or subdivisions.',
    'animals-nature': 'Additional animal and nature emojis unique to OpenMoji.',
    brand: 'Brand-related emojis, including logos and symbols.',
    'climate-environment':
      'Emojis representing climate and environmental themes.',
    emergency: 'Emergency-related symbols, such as sirens and warning lights.',
    flags: 'Unique flags contributed by OpenMoji.',
    'food-drink': 'Additional food and drink items unique to OpenMoji.',
    gardening: 'Gardening-related items like plants, tools, and seeds.',
    healthcare: 'Healthcare symbols and tools unique to OpenMoji.',
    interaction:
      'Interaction-related symbols, such as shaking hands or waving.',
    objects: "Additional objects unique to OpenMoji's library.",
    people: 'Extra people and gestures unique to OpenMoji.',
    'smileys-emotion': 'Unique smileys and emotional expressions.',
    'symbol-other': 'Miscellaneous symbols contributed by OpenMoji.',
    symbols: 'Additional symbolic emojis from OpenMoji.',
    technology: 'Technology-themed symbols and devices unique to OpenMoji.',
    'travel-places': 'Additional travel and place-related emojis.',
    'ui-element': 'User interface elements, such as buttons and icons.',
    'food-drink': 'Additional food and drink items contributed by Unicode.',
    'regional-indicator':
      'Regional indicator symbols representing letters for flags.',
    'subdivision-flag': 'Subdivision flags added by Unicode.',
    'symbol-other': 'Miscellaneous symbols added by Unicode.',
  };
  return content[subgroup] || 'Explore emojis in this subgroup.';
}

// Add event listener to the search input
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  if (query) {
    // Apply search to current filters
    applyFilters();
  } else {
    // No search query - apply current filters
    applyFilters();
  }
});

clearFiltersBtn.addEventListener('click', function() {
  groupFilter.value = '';
  subgroupFilter.value = '';
  subgroupFilter.disabled = true;
  searchInput.value = '';
  applyFilters();
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
