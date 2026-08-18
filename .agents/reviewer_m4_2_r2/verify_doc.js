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
const foundPubkeys = docContent.match(/G[A-Za-z0-9]{55}/g) || [];
console.log("Found pubkeys in doc:", foundPubkeys.length);
foundPubkeys.forEach((pk, i) => {
  const isValid = pubkeyRegex.test(pk);
  console.log(`Pubkey ${i+1}: ${pk} -> Valid: ${isValid}`);
});

// Check root fields in UserProfileResponse schema in OpenAPI spec
console.log("\n--- Checking UserProfileResponse schema ---");
const userProfileResponseBlock = yamlStr.match(/UserProfileResponse:[\s\S]*?(?=\r?\n    [A-Z]|\r?\n---|\r?\n```)/);
if (userProfileResponseBlock) {
  console.log("UserProfileResponse block found!");
  console.log(userProfileResponseBlock[0]);
} else {
  console.error("UserProfileResponse block NOT found!");
}

// Check 405 Method Not Allowed declarations in OpenAPI YAML
console.log("\n--- Checking 405 Method Not Allowed in OpenAPI spec ---");
const matches405 = yamlStr.match(/'405':[\s\S]*?description: Method Not Allowed/g) || [];
console.log("Count of '405' responses in YAML:", matches405.length);

// Check 405 declarations in markdown text
const mdMatches405 = docContent.match(/405 Method Not Allowed/g) || [];
console.log("Count of '405 Method Not Allowed' in markdown text:", mdMatches405.length);
