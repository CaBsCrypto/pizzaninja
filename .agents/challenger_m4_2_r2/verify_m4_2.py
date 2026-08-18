import re
import sys
import os

doc_path = r"C:\Users\MGC\Documents\antigravity\blissful-hawking\docs\API_REFERENCE.md"

if not os.path.exists(doc_path):
    print(f"ERROR: {doc_path} not found")
    sys.exit(1)

with open(doc_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.splitlines()

print(f"Loaded {len(lines)} lines from API_REFERENCE.md")

# 1. Stellar Public Key Regex verification
# Any string matching G followed by 55 alphanumeric characters (or starting with G in pubkey fields)
# Let's search for potential Stellar pubkeys: starting with 'G' and 56 uppercase alphanumeric chars or similar
stellar_regex = re.compile(r'\bG[A-Z0-9]{55}\b')
all_g_keys = re.findall(r'G[A-Za-z0-9]{55}', content)
valid_stellar_regex = re.compile(r'^G[A-Z2-7]{55}$')

print("\n--- 1. STELLAR PUBLIC KEYS CHECK ---")
print(f"Total candidate Stellar keys found (G + 55 chars): {len(all_g_keys)}")

invalid_keys = []
invalid_char_keys = []

for idx, key in enumerate(all_g_keys):
    is_valid = bool(valid_stellar_regex.match(key))
    has_invalid_digits = any(c in key for c in ['0', '1', '8', '9'])
    if not is_valid or has_invalid_digits:
        invalid_keys.append(key)
        print(f"FAIL: Key #{idx+1} '{key}' - valid_regex={is_valid}, has_0189={has_invalid_digits}")
    else:
        print(f"PASS: Key #{idx+1} '{key}'")

if not invalid_keys:
    print("ALL STELLAR PUBKEYS PASSED REGEX /^G[A-Z2-7]{55}$/ AND CONTAIN NO 0, 1, 8, 9.")
else:
    print(f"FAILED: {len(invalid_keys)} invalid pubkeys found!")

# 2. Check Section 6 & 7 Code Examples
print("\n--- 2. SECTIONS 6 & 7 CODE EXAMPLES CHECK ---")
sec6_idx = content.find("Section 6") if "Section 6" in content else content.find("/api/mint")
mint_pos = content.find("/api/mint")
mint_nft_pos = content.find("/api/mint_nft")

print(f"/api/mint position: {mint_pos}")
print(f"/api/mint_nft position: {mint_nft_pos}")

# Let's check for cURL and TypeScript examples under mint and mint_nft sections
# We can search in the text following mint and mint_nft
mint_section = content[mint_pos:mint_nft_pos] if (mint_pos != -1 and mint_nft_pos != -1) else content[mint_pos:]
mint_nft_section = content[mint_nft_pos:]

print("Checking /api/mint section for cURL and TypeScript fetch examples:")
has_mint_curl = "curl -X POST" in mint_section or "curl" in mint_section
has_mint_ts = ("fetch(" in mint_section or "fetch('" in mint_section or "fetch(\"" in mint_section) and ("typescript" in mint_section.lower() or "javascript" in mint_section.lower())
print(f"  cURL example present in /api/mint: {has_mint_curl}")
print(f"  TypeScript/JS fetch example present in /api/mint: {has_mint_ts}")

print("Checking /api/mint_nft section for cURL and TypeScript fetch examples:")
has_mint_nft_curl = "curl -X POST" in mint_nft_section or "curl" in mint_nft_section
has_mint_nft_ts = ("fetch(" in mint_nft_section or "fetch('" in mint_nft_section or "fetch(\"" in mint_nft_section) and ("typescript" in mint_nft_section.lower() or "javascript" in mint_nft_section.lower())
print(f"  cURL example present in /api/mint_nft: {has_mint_nft_curl}")
print(f"  TypeScript/JS fetch example present in /api/mint_nft: {has_mint_nft_ts}")

# 3. UserProfileResponse Schema Check
print("\n--- 3. USERPROFILERESPONSE SCHEMA CHECK ---")
schema_pos = content.find("UserProfileResponse:")
if schema_pos != -1:
    schema_block = content[schema_pos:schema_pos+2000]
    required_fields = ['success', 'user', 'stats', 'pubkey', 'username', 'avatar', 'privyDid', 'createdAt', 'updatedAt', 'scores', 'rank']
    missing_fields = [f for f in required_fields if f not in schema_block]
    print(f"Schema block found. Missing root fields in UserProfileResponse: {missing_fields}")
else:
    print("FAIL: UserProfileResponse block not found in OpenAPI YAML!")

# 4. Check 405 Status Declarations
print("\n--- 4. 405 STATUS DECLARATION CHECK ---")
yaml_pos = content.find("```yaml")
yaml_end = content.find("```", yaml_pos + 7) if yaml_pos != -1 else -1
openapi_yaml = content[yaml_pos:yaml_end] if yaml_pos != -1 else ""

paths_to_check = ['/user', '/leaderboard', '/leaderboard/rank', '/score', '/mint', '/mint_nft']
missing_405_yaml = []
for p in paths_to_check:
    if p in openapi_yaml:
        # Check if '405' occurs in the path block
        p_idx = openapi_yaml.find(p + ":")
        next_p_idx = openapi_yaml.find("\n  /", p_idx + 1)
        if next_p_idx == -1:
            next_p_idx = len(openapi_yaml)
        p_block = openapi_yaml[p_idx:next_p_idx]
        if "'405'" in p_block or '"405"' in p_block or "405:" in p_block:
            print(f"PASS: 405 declared in YAML for path {p}")
        else:
            print(f"FAIL: 405 missing in YAML for path {p}")
            missing_405_yaml.append(p)
    else:
        print(f"WARNING: Path {p} not found in OpenAPI YAML")

print("\nChecking Markdown endpoint sections for 405 Method Not Allowed:")
missing_405_md = []
for p in paths_to_check:
    p_pos = content.find(f"`{p}`") if f"`{p}`" in content else content.find(p)
    if p_pos != -1:
        # Check next 3000 chars
        sec = content[p_pos:p_pos+3000]
        if "405 Method Not Allowed" in sec or "405" in sec:
            print(f"PASS: 405 present in Markdown section for {p}")
        else:
            print(f"FAIL: 405 missing in Markdown section for {p}")
            missing_405_md.append(p)

print("\n--- SUMMARY ---")
if not invalid_keys and has_mint_curl and has_mint_ts and has_mint_nft_curl and has_mint_nft_ts and not missing_fields and not missing_405_yaml and not missing_405_md:
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
else:
    print("SOME VERIFICATION CHECKS FAILED.")
