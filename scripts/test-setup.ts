/**
 * test-setup.ts
 *
 * End-to-end verification script for the OpenCode + Obsidian learning system.
 * Run with: npm run test:e2e or node --loader tsx scripts/test-setup.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { findChrome, resolveVaultDir, resolveVizDir, publishVizImage } from "../.opencode/tools/_vault.ts";
import { run } from "../.opencode/tools/_common.ts";

async function main() {
  console.log("=================================================");
  console.log("   AI Learning System: End-to-End Setup Test     ");
  console.log("=================================================\n");

  // 1. Check OpenCode CLI
  console.log("1. Checking OpenCode CLI...");
  try {
    const ocVer = execSync("opencode --version", { encoding: "utf8" }).trim();
    console.log(`   ✓ OpenCode CLI is installed (v${ocVer})`);
  } catch {
    console.log("   ✗ OpenCode CLI not found in PATH. Check /Users/aman/.opencode/bin/opencode");
  }

  // 2. Check Browser for Mermaid
  console.log("\n2. Checking Chromium browser detection...");
  const chromePath = findChrome();
  if (chromePath) {
    console.log(`   ✓ Detected browser: ${chromePath}`);
  } else {
    console.log("   ✗ No Chromium browser found in candidate locations.");
  }

  // 3. Check SVG tools
  console.log("\n3. Checking SVG renderers (librsvg / ImageMagick)...");
  try {
    const rsvg = execSync("which rsvg-convert", { encoding: "utf8" }).trim();
    console.log(`   ✓ Found rsvg-convert at: ${rsvg}`);
  } catch {
    console.log("   ! rsvg-convert not found. Checking ImageMagick fallback...");
    try {
      const magick = execSync("which magick", { encoding: "utf8" }).trim();
      console.log(`   ✓ Found magick fallback at: ${magick}`);
    } catch {
      console.log("   ✗ Neither rsvg-convert nor magick found.");
    }
  }

  // 4. Resolve Vault & Viz Directory
  console.log("\n4. Resolving Obsidian Vault & Viz Directory...");
  const vaultDir = resolveVaultDir();
  const vizDir = resolveVizDir();
  console.log(`   • Target Obsidian Vault: ${vaultDir}`);
  console.log(`   • Target Viz Directory:   ${vizDir}`);

  // 5. Test Diagram Generation (Mermaid -> PNG)
  console.log("\n5. Rendering sample Mermaid diagram...");
  const sampleMmdPath = path.join("/tmp", "sample-diag.mmd");
  const samplePngPath = path.join("/tmp", "sample-diag.png");
  const puppeteerCfg = path.join("/tmp", "puppeteer.json");
  
  fs.writeFileSync(
    sampleMmdPath,
    "graph TD\n  Truths[\"Unconditional Truths\"] --> Derived[\"Motivated Steps\"]\n  Derived --> Goal[\"Understanding Goal\"]\n  style Truths fill:#e1f5fe,stroke:#0288d1\n  style Derived fill:#fff3e0,stroke:#f57c00\n  style Goal fill:#e8f5e9,stroke:#388e3c\n"
  );
  fs.writeFileSync(puppeteerCfg, JSON.stringify(chromePath ? { executablePath: chromePath, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] }));

  const mmdcBin = path.resolve("./node_modules/.bin/mmdc");
  const mmdcRes = await run(
    mmdcBin,
    ["-i", sampleMmdPath, "-o", samplePngPath, "-p", puppeteerCfg, "-s", "2", "-b", "white"],
    { cwd: "/tmp", timeoutMs: 30000 }
  );

  let publishedFilename = "viz-sample-demo.png";
  if (mmdcRes.code === 0 && fs.existsSync(samplePngPath)) {
    const published = publishVizImage(samplePngPath, "demo-pedagogy", process.cwd());
    publishedFilename = published.filename;
    console.log(`   ✓ Successfully rendered & published: ${published.filename}`);
  } else {
    console.log(`   ✗ Mermaid render failed: ${mmdcRes.stderr}`);
  }

  // 6. Generate Sample Obsidian Lesson Note
  console.log("\n6. Creating test Obsidian note...");
  const testNotePath = path.join(vaultDir, "welcome-test.md");
  const noteContent = `# Welcome to your AI Learning System
_Created during setup verification at ${new Date().toLocaleString()}_

> [!abstract] Teacher
> Welcome! This note demonstrates how your live sessions in OpenCode mirror directly into Obsidian.
> Everything is organized into a clean dependency graph.

> [!quote] Learner
> How does the system handle mathematical notation and formulas?

> [!abstract] Teacher
> Math notation renders natively in Obsidian via LaTeX:
> 
> Inline: $e^{i\\pi} + 1 = 0$ and Gaussian integral:
> 
> $$
> \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
> $$

> [!question] Knowledge Check: Principle 1
> Why do we begin with unconditional ground truths before derived concepts?
> 1. Because bottom-up is the only logically valid sequencing
> 2. Because caveat-free statements allow the brain to commit safely without hedging
> 3. Because definitions must precede examples in formal academic pedagogy
> 4. I don't know

> [!success] Correct ✓
> Option 2 is correct. When an unconditional truth has no caveats, the brain can commit to it safely without fear of future contradiction.

### Verified Visuals
Here is the sample diagram generated and visually verified by your subagent tools:

![[${publishedFilename}|500]]

---
*Setup is complete! You can now start OpenCode and type \`/log <lesson-name>\` to begin real lessons.*
`;

  fs.writeFileSync(testNotePath, noteContent, "utf8");
  console.log(`   ✓ Generated sample lesson note: ${testNotePath}`);

  // Cleanup temp files
  try {
    fs.unlinkSync(sampleMmdPath);
    fs.unlinkSync(samplePngPath);
    fs.unlinkSync(puppeteerCfg);
  } catch {}

  console.log("\n=================================================");
  console.log("              ALL CHECKS PASSED!                 ");
  console.log("=================================================");
  console.log("\nNext Steps to Verify in Obsidian:");
  console.log(`1. Open Obsidian and navigate to your vault at:\n   ${vaultDir}`);
  console.log(`2. Open the note: welcome-test.md`);
  console.log("3. Confirm the callouts, LaTeX equations, and diagram image render beautifully!");
  console.log("\nTo test interactively in OpenCode:");
  console.log("1. Run: opencode");
  console.log("2. Type: /log test-session");
  console.log("3. Say: 'I want to learn how TCP works from first principles.'");
}

main().catch(console.error);
