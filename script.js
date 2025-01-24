const emojiList = document.getElementById('emoji-list');
const searchInput = document.getElementById('search');
let firstLoad = true;
let emojiData = []; // Store fetched emoji data
const batchSize = 2; // Number of groups to load per batch
let currentBatch = 0;

// Adjust the relative path based on the current location
const jsonPath = new URL('grouped-openmoji.json', window.location.origin).href;

// Fetch emoji data and render initially
fetch(jsonPath)
  .then((res) => res.json())
  .then((data) => {
    emojiData = data; // Store the grouped data directly
    renderBatch(emojiData); // Render initial emojis in batches
    setupLazyLoading(emojiData); // Setup lazy loading
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
                              onclick="copyToClipboard('${emoji.emoji}')"
                            >
                            <hr/>
                            <a href="/${group}/${subgroup}/${sanitizeAnnotation(
                          emoji.annotation
                        )}">
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
  const query = e.target.value.toLowerCase();

  if (query) {
    const filteredEmojis = {};
    Object.entries(emojiData).forEach(([group, subgroups]) => {
      Object.entries(subgroups).forEach(([subgroup, emojis]) => {
        const filtered = emojis.filter(
          (emoji) =>
            emoji.annotation.toLowerCase().includes(query) || // Search in annotation
            (emoji.tags && emoji.tags.toLowerCase().includes(query)) // Search in tags if available
        );
        if (filtered.length > 0) {
          if (!filteredEmojis[group]) filteredEmojis[group] = {};
          filteredEmojis[group][subgroup] = filtered;
        }
      });
    });

    renderEmojis(filteredEmojis, true); // Render filtered results
  } else {
    // Reset to the full emoji list with lazy loading
    renderEmojis(emojiData, false);
  }
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
