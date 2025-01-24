const fs = require('fs');
const path = require('path');

// Load the emoji data (use grouped.json)
const emojiData = require('../grouped-openmoji.json');

// Base URL for the sitemap
const BASE_URL = 'https://emoj.ie'; // Replace with your actual website URL

// Helper function to create folders and files
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper function to sanitize annotation for folder names
function sanitizeAnnotation(annotation) {
  return annotation
    .replaceAll(/[&,<>:"/\\|?*\s]/g, '-')
    .toLowerCase()
    .replaceAll('--', '-');
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

// Helper function to generate HTML
function generateHTML(title, content, depth = 0, breadcrumbs = '') {
  const relativePath = '../'.repeat(depth); // Adjust path based on depth
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta
      property="og:title"
      content="emoj.ie - ${title}"
    />
    <meta
      property="og:description"
      content="Find and copy emojis quickly from categories like smileys, animals, and flags. Perfect for fun or professional use."
    />
    <meta property="og:image" content="https://emoj.ie/logo.png" />
    <meta property="og:url" content="https://emoj.ie" />
    <meta property="og:type" content="website" />
    <title>emoj.ie - ${title}</title>
    <link rel="icon" href="${relativePath}favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="${relativePath}style.css">
  </head>
  <body>
    <header class="header">
      <div class="header-container">
        <a href="/" class="logo"><img src="${relativePath}logo.svg" alt="Emoj.ie Logo" /></a>
        ${
          depth === 0
            ? `
        <div class="search-container">
          <input type="text" id="search" placeholder="Search emojis..." aria-label="Search emojis" />
        </div>`
            : ''
        }
      </div>
    </header>
    <nav class="breadcrumbs">${breadcrumbs}</nav> <!-- Breadcrumbs Section -->
    <main id="emoji-list">
        ${content}
    </main>
    <button id="back-to-top" class="back-to-top" aria-label="Back to top">
        ↑
    </button>
    <footer>
        <p>© 2025 Emoj.ie | <a href="${relativePath}about">About</a></p>
    </footer>
    ${
      depth === 0
        ? `<script src="${relativePath}script.js"></script>`
        : `<script>
          // Show a toast message
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
    
          // Copy emoji to clipboard
          function copyToClipboard(emoji) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard
                .writeText(emoji)
                .then(() => {
                  showToast("Copied: " + emoji);
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
                showToast("Copied: " + emoji);
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
        </script>`
    }
  </body>
  </html>
    `;
}

// Generate pages and sitemap
function generatePages(outputDir) {
  const sitemapUrls = [];

  Object.entries(emojiData).forEach(([group, subgroups]) => {
    const groupPath = path.join(outputDir, group);
    ensureDir(groupPath);

    // Add group to sitemap
    sitemapUrls.push(`${BASE_URL}/${group}`);

    // Generate group index.html
    const groupContent = `
    <div class="group">
      <h2>${group.replaceAll('-', ' ')}</h2>
      <p>${generateGroupContent(group)}</p>
      <hr class="group-divider">
      ${Object.entries(subgroups)
        .map(([subgroup, emojis]) => {
          return `
            <div class="subgroup">
              <a href="./${subgroup}">
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
                        title="${sanitizeAnnotation(
                          emoji.annotation
                        ).replaceAll('-', ' ')}" 
                      >
                        <img 
                          src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(
                            emoji.hexcode
                          )}.svg" 
                          alt="${sanitizeAnnotation(
                            emoji.annotation
                          ).replaceAll('-', ' ')}" 
                          loading="lazy"
                          onclick="copyToClipboard('${emoji.emoji}')"
                        >
                        <hr/>
                        <a href="./${subgroup}/${sanitizeAnnotation(
                      emoji.annotation
                    ).replaceAll('--', '-')}">
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
    const groupBreadcrumbs = `<a href="../">Home</a> / <span>${group.replaceAll(
      '-',
      ' '
    )}</span>`;
    fs.writeFileSync(
      path.join(groupPath, 'index.html'),
      generateHTML(group, groupContent, 1, groupBreadcrumbs) // Depth = 1 (group level)
    );

    Object.entries(subgroups).forEach(([subgroup, emojis]) => {
      const subgroupPath = path.join(groupPath, subgroup);
      ensureDir(subgroupPath);

      // Add subgroup to sitemap
      sitemapUrls.push(`${BASE_URL}/${group}/${subgroup}`);

      // Generate subgroup index.html
      const subgroupContent = `
      <div class="subgroup">
        <h3>${subgroup.replaceAll('-', ' ')}</h3>
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
                  title="${sanitizeAnnotation(emoji.annotation).replaceAll(
                    '-',
                    ' '
                  )}" 
                >
                  <img 
                    src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${formatHexcode(
                      emoji.hexcode
                    )}.svg" 
                    alt="${sanitizeAnnotation(emoji.annotation).replaceAll(
                      '-',
                      ' '
                    )}" 
                    loading="lazy"
                    onclick="copyToClipboard('${emoji.emoji}')"
                  >
                  <hr/>
                  <a href="./${sanitizeAnnotation(emoji.annotation).replaceAll('--', '-')}">
                    <small>${sanitizeAnnotation(emoji.annotation).replaceAll(
                      '-',
                      ' '
                    )}</small>
                  </a>
                </li>
              `;
            })
            .join('')}
        </ul>
      </div>
    `;
      const subgroupBreadcrumbs = `<a href="../../">Home</a> / <a href="../">${group.replaceAll(
        '-',
        ' '
      )}</a> / <span>${subgroup.replaceAll('-', ' ')}</span>`;
      fs.writeFileSync(
        path.join(subgroupPath, 'index.html'),
        generateHTML(subgroup, subgroupContent, 2, subgroupBreadcrumbs) // Depth = 2 (subgroup level)
      );

      emojis.forEach((emoji) => {
        const emojiFolder = sanitizeAnnotation(emoji.annotation).replaceAll(
          '--',
          '-'
        );
        const emojiPath = path.join(subgroupPath, emojiFolder);
        ensureDir(emojiPath);

        // Add emoji to sitemap
        sitemapUrls.push(`${BASE_URL}/${group}/${subgroup}/${emojiFolder}`);

        // Generate emoji index.html
        const emojiContent = `
          <div>
            <h1>${emoji.emoji}</h1>
            <h3>${sanitizeAnnotation(emoji.annotation).replaceAll(
              '-',
              ' '
            )}</h3>
            <img src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${
              emoji.hexcode
            }.svg" alt="${sanitizeAnnotation(emoji.annotation)}"
            onclick="copyToClipboard('${emoji.emoji}')">
          </div>
        `;
        const emojiBreadcrumbs = `<a href="../../../">Home</a> / <a href="../../">${group.replaceAll(
          '-',
          ' '
        )}</a> / <a href="../">${subgroup.replaceAll(
          '-',
          ' '
        )}</a> / <span>${sanitizeAnnotation(emoji.annotation).replaceAll(
          '-',
          ' '
        )}</span>`;
        fs.writeFileSync(
          path.join(emojiPath, 'index.html'),
          generateHTML(emoji.annotation, emojiContent, 3, emojiBreadcrumbs) // Depth = 3 (emoji level)
        );
      });
    });
  });

  // Generate sitemap.xml
  const sitemapContent = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://emoj.ie/about</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
  ${sitemapUrls
    .map(
      (url) => `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n')}
</urlset>
  `;
  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemapContent.trim());
}

// Run the script
const outputDirectory = path.resolve(__dirname, '..');
ensureDir(outputDirectory);
generatePages(outputDirectory);

console.log('Pages and sitemap.xml generated successfully!');
