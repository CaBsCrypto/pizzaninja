import fs from 'fs';
import readline from 'readline';

const logFile = "C:\\Users\\MGC\\.gemini\\antigravity\\brain\\0ff96fcc-e4ff-42d6-b1cb-1a96d78d7c8f\\.system_generated\\logs\\transcript.jsonl";

async function run() {
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching transcript.jsonl for HandTracker.tsx edits...");
  let count = 0;
  for await (const line of rl) {
    if (line.includes("replace_file_content") && line.includes("HandTracker.tsx")) {
      const data = JSON.parse(line);
      console.log(`Step ${data.step_index} (${data.created_at}):`);
      
      const toolCalls = data.tool_calls || [];
      toolCalls.forEach((tc) => {
        if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
          console.log(`  Description: ${tc.args.Description}`);
          console.log(`  Instruction: ${tc.args.Instruction}`);
          if (tc.args.ReplacementContent) {
            console.log(`  Replacement length: ${tc.args.ReplacementContent.length}`);
          }
        }
      });
      count++;
    }
  }
  console.log(`Total occurrences found: ${count}`);
}

run().catch(console.error);
