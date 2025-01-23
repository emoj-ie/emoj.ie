const fs = require('fs');
const path = require('path');

// Function to generate groups and subgroups JSON
function generateGroupStructure(emojis) {
  const result = {};

  emojis.forEach((emoji) => {
    const { group, subgroups } = emoji;

    if (!result[group]) {
      result[group] = {};
    }

    if (!result[group][subgroups]) {
      result[group][subgroups] = [];
    }

    result[group][subgroups].push(emoji); // Add emoji annotation (or modify as needed)
  });

  return result;
}

// Path to the openmoji.json file
const inputFilePath = path.join(__dirname, '../openmoji.json');
const outputFilePath = path.join(__dirname, '../grouped-openmoji.json');

// Read and process the JSON file
fs.readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error loading emoji data:', err);
    return;
  }

  try {
    const emojiData = JSON.parse(data); // Parse JSON file
    const grouped = generateGroupStructure(emojiData); // Generate grouped structure

    // Write the grouped JSON to a file
    fs.writeFile(
      outputFilePath,
      JSON.stringify(grouped, null, 2),
      'utf8',
      (writeErr) => {
        if (writeErr) {
          console.error('Error writing grouped JSON:', writeErr);
        } else {
          console.log(`Grouped JSON saved to ${outputFilePath}`);
        }
      }
    );
  } catch (parseError) {
    console.error('Error parsing emoji data:', parseError);
  }
});
