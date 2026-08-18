const fs = require('fs');

const docContent = fs.readFileSync('docs/API_REFERENCE.md', 'utf8');

// Extract yaml block
const yamlMatch = docContent.match(/```yaml\s*([\s\S]*?)\s*```/);
if (!yamlMatch) {
  console.error("YAML block not found!");
  process.exit(1);
}

const yamlStr = yamlMatch[1];
console.log("YAML block length:", yamlStr.length);

// Let's check regex for Stellar pubkeys in document
const pubkeyRegex = /^G[A-Z2-7]{55}$/;
// Match any G followed by 55 base32 chars
const foundPubkeys = docContent.match(/G[A-Z2-7]{55}/g) || [];
console.log("Found valid pubkeys in doc count:", foundPubkeys.length);

// Also search for any invalid G-pubkeys (like containing 0, 1, 8, 9 or wrong length)
const allGStrings = docContent.match(/G[A-Za-z0-9]{50,60}/g) || [];
console.log("All G... string occurrences count:", allGStrings.length);
let invalidCount = 0;
allGStrings.forEach((pk, i) => {
  const isValid = pubkeyRegex.test(pk);
  if (!isValid) {
    invalidCount++;
    console.error(`Invalid Pubkey found #${i+1}: "${pk}"`);
  }
});
console.log("Invalid Pubkey Count:", invalidCount);

// Check root fields in UserProfileResponse schema in OpenAPI spec
console.log("\n--- Checking UserProfileResponse schema ---");
const userProfileResponseMatch = yamlStr.match(/UserProfileResponse:[\s\S]*?(?=\r?\n    [A-Z]|\r?\n---|\r?\n```)/);
if (userProfileResponseMatch) {
  console.log("UserProfileResponse block in YAML:");
  console.log(userProfileResponseMatch[0]);
} else {
  console.error("UserProfileResponse block NOT found in YAML!");
}

// Check 405 Method Not Allowed declarations in OpenAPI YAML
console.log("\n--- Checking 405 Method Not Allowed in OpenAPI spec ---");
const matches405 = yamlStr.match(/'405':[\s\S]*?description: Method Not Allowed/g) || [];
console.log("Count of '405' responses in YAML:", matches405.length);

// Check 405 declarations in markdown text
const mdMatches405 = docContent.match(/405 Method Not Allowed/g) || [];
console.log("Count of '405 Method Not Allowed' in markdown text:", mdMatches405.length);
