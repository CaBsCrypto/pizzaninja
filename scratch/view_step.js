import fs from 'fs';
import readline from 'readline';

const logFile = "C:\\Users\\MGC\\.gemini\\antigravity\\brain\\0ff96fcc-e4ff-42d6-b1cb-1a96d78d7c8f\\.system_generated\\logs\\transcript.jsonl";

async function run() {
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching for HandTracker.tsx code 2 days ago...");
  for await (const line of rl) {
    const data = JSON.parse(line);
    // Find the step around step 1788 or 2125
    if (data.step_index === 1788 || data.step_index === 2125) {
      console.log(`Step ${data.step_index} (${data.created_at}):`);
      console.log(JSON.stringify(data.tool_calls, null, 2));
    }
  }
}

run().catch(console.error);
