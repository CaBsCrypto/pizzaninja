import fs from 'fs';
import readline from 'readline';

const logFile = "C:\\Users\\MGC\\.gemini\\antigravity\\brain\\0ff96fcc-e4ff-42d6-b1cb-1a96d78d7c8f\\.system_generated\\logs\\transcript.jsonl";

async function run() {
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching for handleHandCoordsTracked history...");
  for await (const line of rl) {
    const data = JSON.parse(line);
    const step = data.step_index;
    
    // Look at tool calls modifying PizzaCanvas.tsx
    const toolCalls = data.tool_calls || [];
    for (const tc of toolCalls) {
      const targetFile = tc.args.TargetFile || tc.args.targetFile || "";
      if (targetFile.includes("PizzaCanvas.tsx")) {
        const content = JSON.stringify(tc.args);
        if (content.includes("handleHandCoordsTracked")) {
          console.log(`\n--- Step ${step} (${data.created_at}) modified PizzaCanvas.tsx ---`);
          if (tc.name === 'replace_file_content') {
            console.log("REPLACE TARGET:");
            console.log(tc.args.TargetContent?.substring(0, 400));
            console.log("REPLACEMENT CONTENT:");
            console.log(tc.args.ReplacementContent?.substring(0, 400));
          } else if (tc.name === 'multi_replace_file_content') {
            const chunks = tc.args.ReplacementChunks || tc.args.replacementChunks || [];
            for (const chunk of chunks) {
              if (JSON.stringify(chunk).includes("handleHandCoordsTracked")) {
                console.log("CHUNK TARGET:");
                console.log(chunk.TargetContent?.substring(0, 400));
                console.log("CHUNK REPLACEMENT:");
                console.log(chunk.ReplacementContent?.substring(0, 400));
              }
            }
          }
        }
      }
    }
  }
}

run().catch(console.error);
