/**
 * obsidian-logger.ts
 *
 * OpenCode plugin that mirrors teaching sessions in real-time to an Obsidian markdown note.
 *
 * Features:
 *   - Configurable vault root (via OBSIDIAN_VAULT_PATH, opencode.jsonc, or /log command)
 *   - Live append-only logging of learner inputs, teacher prose, question/quiz cards, and diagrams
 *   - Obsidian-native formatting: callouts (> [!quote], > [!abstract], > [!question], > [!success]),
 *     LaTeX math ($...$ and $$...$$), and wikilink image embeds (![[viz-....png|500]])
 *
 * Commands:
 *   /log <filename>   — Begin logging to <vault>/<filename>.md (e.g. /log tcp-lesson)
 *   /unlog            — Stop active session logging
 */

import { type Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveVaultDir } from "../tools/_common.ts";

function formatDate(d: Date = new Date()): string {
  return d.toISOString().replace(/T/, " ").replace(/\..+/, "");
}

function callout(type: string, title: string, bodyLines: string[]): string {
  const lines = [`> [!${type}] ${title}`];
  for (const line of bodyLines) {
    lines.push(line.length === 0 ? ">" : `> ${line}`);
  }
  return lines.join("\n");
}

export const ObsidianLoggerPlugin: Plugin = async ({ directory }) => {
  let activeLogPath: string | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  function withLock(fn: () => void | Promise<void>): Promise<void> {
    const prev = writeQueue;
    writeQueue = prev.then(fn).catch(() => {});
    return writeQueue;
  }

  function appendToLog(block: string): void {
    const targetFile = activeLogPath;
    if (!targetFile) return;
    withLock(() => {
      try {
        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let current = "";
        if (fs.existsSync(targetFile)) {
          current = fs.readFileSync(targetFile, "utf8");
        }
        const separator = current.trim().length > 0 ? "\n\n" : "";
        fs.writeFileSync(targetFile, current + separator + block + "\n", "utf8");
      } catch (err) {
        // Fail silently so lesson flow is never broken
      }
    });
  }

  function startLogging(arg: string): void {
    const vault = resolveVaultDir(directory);
    const baseName = arg.trim().length > 0 ? arg.trim() : `lesson-${Date.now()}`;
    const cleanName = baseName.endsWith(".md") ? baseName : `${baseName}.md`;

    activeLogPath = path.isAbsolute(cleanName)
      ? cleanName
      : path.join(vault, cleanName);

    if (!fs.existsSync(activeLogPath)) {
      const header = `# Lesson: ${path.basename(activeLogPath, ".md")}\n_Started: ${formatDate()}_\n`;
      fs.writeFileSync(activeLogPath, header, "utf8");
    }

    appendToLog(`> [!note] Logging Active\n> Linked note: \`${path.basename(activeLogPath)}\` in Obsidian vault.`);
  }

  function stopLogging(): void {
    if (activeLogPath) {
      appendToLog(`> [!note] Logging Paused\n> Session logging stopped at ${formatDate()}.`);
      activeLogPath = null;
    }
  }

  return {
    // Intercept slash command executions
    "command.execute.before": async (input) => {
      if (input.command === "log") {
        startLogging(input.arguments || "");
      } else if (input.command === "unlog") {
        stopLogging();
      }
    },

    // Intercept chat messages for fallback or user prompt logging
    "chat.message": async (input, output) => {
      for (const part of output.parts) {
        if (part.type === "text") {
          const trimmed = part.text.trim();
          if (trimmed.startsWith("/log")) {
            startLogging(trimmed.slice(4).trim());
          } else if (trimmed === "/unlog") {
            stopLogging();
          } else if (activeLogPath && !trimmed.startsWith("/")) {
            // Log learner's text input
            appendToLog(callout("quote", "Learner", trimmed.split("\n")));
          }
        }
      }
    },

    // Capture tool executions (such as question modals or published diagrams)
    "tool.execute.after": async (input, output) => {
      if (!activeLogPath) return;

      // Handle OpenCode's native question tool
      if (input.tool === "question") {
        const args = input.args as any;
        const questions = Array.isArray(args?.questions) ? args.questions : [];
        for (const q of questions) {
          const body: string[] = [];
          if (q.question) body.push(q.question);
          if (Array.isArray(q.options) && q.options.length > 0) {
            body.push("");
            body.push("**Options:**");
            q.options.forEach((opt: any, idx: number) => {
              const label = typeof opt === "string" ? opt : opt.label || JSON.stringify(opt);
              body.push(`${idx + 1}. ${label}`);
            });
          }
          if (output.output) {
            body.push("");
            body.push(`**Selection:** ${output.output}`);
          }
          appendToLog(callout("question", q.header || "Question", body));
        }
      }

      // Handle diagram publishes
      if (
        (input.tool === "render_mermaid" || input.tool === "render_svg") &&
        input.args?.save_as
      ) {
        const outText = output.output || "";
        const match = outText.match(/filename:\s*(viz-[^\s]+)/);
        if (match && match[1]) {
          const filename = match[1];
          appendToLog(`![[${filename}|500]]`);
        }
      }
    },

    // Capture model assistant messages for teaching prose
    event: async ({ event }) => {
      if (!activeLogPath) return;

      // When message updates with completed text
      if (event.type === "message.updated") {
        const msg = (event as any).message;
        if (msg && msg.role === "assistant" && Array.isArray(msg.parts)) {
          for (const part of msg.parts) {
            if (part.type === "text" && part.text) {
              const text = part.text.trim();
              if (text.length > 0 && !text.startsWith("RESULT:")) {
                appendToLog(callout("abstract", "Teacher", text.split("\n")));
              }
            }
          }
        }
      }
    },
  };
};

export default ObsidianLoggerPlugin;
