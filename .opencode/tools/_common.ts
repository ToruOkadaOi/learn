/**
 * _common.ts
 *
 * Shared execution and editing primitives for Mermaid and SVG authoring loops.
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { findChrome, publishVizImage, resolveVizDir, resolveVaultDir } from "./_vault.ts";

export const EXTRA_PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/local/bin",
];

export const STAGING_ROOT = join(tmpdir(), "opencode-visual-tools");

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; env?: Record<string, string> }
): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const augmentedPath = [...EXTRA_PATH, process.env.PATH ?? ""].join(":");
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}), PATH: augmentedPath },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveRun({ code: null, stdout, stderr: stderr + String(err), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code, stdout, stderr, timedOut });
    });
  });
}

export interface Session {
  workDir: string;
  bodyPath: string;
}

export function sessionDir(group: string): string {
  return join(STAGING_ROOT, `${group}-${process.pid}`);
}

export function writeBody(group: string, bodyFileName: string, source: string): Session {
  const workDir = sessionDir(group);
  mkdirSync(workDir, { recursive: true });
  const bodyPath = join(workDir, bodyFileName);
  writeFileSync(bodyPath, source, "utf8");
  return { workDir, bodyPath };
}

export function applyEdit(
  current: string,
  oldText: string,
  newText: string
): { updated: string; index: number } {
  if (oldText === "") throw new Error("`old_text` must be non-empty.");
  if (oldText === newText) throw new Error("`old_text` and `new_text` are identical.");
  const first = current.indexOf(oldText);
  if (first === -1) {
    throw new Error("`old_text` not found in current source — match it exactly.");
  }
  const second = current.indexOf(oldText, first + 1);
  if (second !== -1) {
    let n = 0;
    let i = current.indexOf(oldText);
    while (i !== -1) {
      n++;
      i = current.indexOf(oldText, i + oldText.length);
    }
    throw new Error(`\`old_text\` appears ${n} times — add surrounding context to make it unique.`);
  }
  const updated = current.slice(0, first) + newText + current.slice(first + oldText.length);
  return { updated, index: first };
}

export function snippetAround(content: string, index: number, contextLines = 3): string {
  const before = content.slice(0, index);
  const hitLine = before.split("\n").length - 1;
  const lines = content.split("\n");
  const start = Math.max(0, hitLine - contextLines);
  const end = Math.min(lines.length - 1, hitLine + contextLines);
  const width = String(end + 1).length;
  const out: string[] = [];
  for (let i = start; i <= end; i++) out.push(`${String(i + 1).padStart(width)}  ${lines[i]}`);
  return out.join("\n");
}

export { findChrome, publishVizImage, resolveVizDir, resolveVaultDir };
