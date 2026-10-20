/**
 * _vault.ts
 *
 * Shared helper for resolving the target Obsidian Vault root and viz/ directory.
 * Resolution precedence:
 *   1. Environment variable OBSIDIAN_VAULT_PATH (e.g. set in .env or shell)
 *   2. obsidianVault property in .opencode/opencode.jsonc (or opencode.json)
 *   3. Fallback: workspace directory (process.cwd())
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Arc.app/Contents/MacOS/Arc",
];

export function findChrome(): string | undefined {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function expandAndEnsurePath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  const expanded = trimmed.startsWith("~")
    ? path.join(os.homedir(), trimmed.slice(1))
    : path.resolve(trimmed);

  if (fs.existsSync(expanded)) {
    return expanded;
  }

  // If path does not exist yet, check if parent exists (e.g. creating a subfolder in a vault)
  try {
    const parent = path.dirname(expanded);
    if (fs.existsSync(parent)) {
      fs.mkdirSync(expanded, { recursive: true });
      return expanded;
    }
  } catch {
    // Ignore and return null
  }
  return null;
}

export function resolveVaultDir(workspaceDir: string = process.cwd()): string {
  // 1. Check environment variable
  const envVault = process.env.OBSIDIAN_VAULT_PATH;
  if (envVault) {
    const valid = expandAndEnsurePath(envVault);
    if (valid) return valid;
  }

  // 2. Check opencode.jsonc or opencode.json in workspace/.opencode or workspace
  const candidateConfigs = [
    path.join(workspaceDir, ".opencode", "opencode.jsonc"),
    path.join(workspaceDir, ".opencode", "opencode.json"),
    path.join(workspaceDir, "opencode.jsonc"),
    path.join(workspaceDir, "opencode.json"),
  ];

  for (const configPath of candidateConfigs) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        // Strip single-line comments before parsing (avoiding // in URLs)
        const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
        const parsed = JSON.parse(stripped);
        if (parsed.obsidianVault && typeof parsed.obsidianVault === "string") {
          const valid = expandAndEnsurePath(parsed.obsidianVault);
          if (valid) return valid;
        }
      } catch {
        // Ignore parse errors and continue
      }
    }
  }

  // 3. Fallback to workspace root
  return path.resolve(workspaceDir);
}

export function resolveVizDir(workspaceDir: string = process.cwd()): string {
  const vaultDir = resolveVaultDir(workspaceDir);
  const vizDir = path.join(vaultDir, "viz");
  if (!fs.existsSync(vizDir)) {
    fs.mkdirSync(vizDir, { recursive: true });
  }
  return vizDir;
}

export function publishVizImage(
  pngPath: string,
  slug: string,
  workspaceDir: string = process.cwd()
): { filename: string; path: string } {
  const vizDir = resolveVizDir(workspaceDir);
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "viz";
  const filename = `viz-${cleanSlug}-${Date.now()}.png`;
  const dest = path.join(vizDir, filename);
  fs.copyFileSync(pngPath, dest);
  return { filename, path: dest };
}
