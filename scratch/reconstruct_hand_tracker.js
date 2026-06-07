import fs from 'fs';
import readline from 'readline';
import { execSync } from 'child_process';

const logFile = "C:\\Users\\MGC\\.gemini\\antigravity\\brain\\0ff96fcc-e4ff-42d6-b1cb-1a96d78d7c8f\\.system_generated\\logs\\transcript.jsonl";

async function run() {
  // 1. Get the base file content from the git scaffolding commit
  console.log("Getting base HandTracker.tsx from git commit b4f1556...");
  let currentCode = "";
  try {
    currentCode = execSync("git show b4f1556:src/components/HandTracker.tsx", { encoding: 'utf8' });
  } catch (err) {
    console.error("Failed to get base file from git. Trying local file read as fallback...", err);
    currentCode = fs.readFileSync("src/components/HandTracker.tsx", "utf8");
  }

  // 2. Read transcript and apply replacements up to step 2611
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Replaying replacements up to step 2611...");
  let toolCallCount = 0;
  for await (const line of rl) {
    const data = JSON.parse(line);
    if (data.step_index > 2611) {
      break;
    }

    const toolCalls = data.tool_calls || [];
    for (const tc of toolCalls) {
      const targetFile = tc.args.TargetFile || tc.args.targetFile || "";
      if (targetFile.includes("HandTracker.tsx")) {
        if (tc.name === 'replace_file_content') {
          const target = tc.args.TargetContent || tc.args.targetContent;
          const replacement = tc.args.ReplacementContent || tc.args.replacementContent;
          
          if (currentCode.includes(target)) {
            currentCode = currentCode.replace(target, replacement);
            console.log(`Applied replace_file_content at step ${data.step_index}`);
            toolCallCount++;
          } else {
            console.warn(`WARNING: Target content not found at step ${data.step_index}`);
          }
        } else if (tc.name === 'multi_replace_file_content') {
          const chunks = tc.args.ReplacementChunks || tc.args.replacementChunks || [];
          for (const chunk of chunks) {
            const target = chunk.TargetContent || chunk.targetContent;
            const replacement = chunk.ReplacementContent || chunk.replacementContent;
            if (currentCode.includes(target)) {
              currentCode = currentCode.replace(target, replacement);
              console.log(`Applied multi_replace_file_content chunk at step ${data.step_index}`);
              toolCallCount++;
            } else {
              console.warn(`WARNING: Chunk target content not found at step ${data.step_index}`);
            }
          }
        }
      }
    }
  }

  console.log(`Reconstruction completed! Applied ${toolCallCount} modifications.`);
  fs.writeFileSync("src/components/HandTracker.tsx.step2610", currentCode, "utf8");
  console.log("Saved reconstructed file to src/components/HandTracker.tsx.step2610");
}

run().catch(console.error);
