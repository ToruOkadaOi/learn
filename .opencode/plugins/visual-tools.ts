/**
 * visual-tools.ts
 *
 * OpenCode plugin registering custom visual authoring tools for Mermaid and SVG:
 *   - write_mermaid, edit_mermaid, render_mermaid
 *   - write_svg, edit_svg, render_svg
 *
 * Saves verified diagrams directly into the configured Obsidian Vault's viz/ directory.
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  applyEdit,
  findChrome,
  publishVizImage,
  resolveVizDir,
  resolveVaultDir,
  run,
  snippetAround,
  writeBody,
  type Session,
} from "../tools/_common.ts";

const GROUP_MERMAID = "mermaid";
const FILE_MERMAID = "diagram.mmd";
const GROUP_SVG = "svg";
const FILE_SVG = "diagram.svg";
const RENDER_TIMEOUT_MS = 60_000;

let mermaidSession: Session | null = null;
let svgSession: Session | null = null;

function resolveMmdcBin(workspaceDir: string): string {
  const candidates = [
    path.join(workspaceDir, "node_modules", ".bin", "mmdc"),
    path.join(workspaceDir, "extensions", "visual-tools", "node_modules", ".bin", "mmdc"),
    "/opt/homebrew/bin/mmdc",
    "/usr/local/bin/mmdc",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "mmdc"; // Fallback to PATH or npx
}

export const VisualToolsPlugin: Plugin = async ({ directory }) => {
  const schema = tool.schema;

  return {
    tool: {
      // ──────────────────────────────────────────────────────────────────────────
      // Mermaid authoring tools
      // ──────────────────────────────────────────────────────────────────────────
      write_mermaid: tool({
        description:
          "Write the FULL Mermaid source to this session's managed file. " +
          "source must be a complete Mermaid diagram (e.g. `graph TD`, `sequenceDiagram`, `stateDiagram-v2`). " +
          "Writing does NOT render — call render_mermaid when ready.",
        args: {
          source: schema.string().describe("The complete Mermaid diagram source."),
        },
        async execute({ source }: { source: string }) {
          const trimmed = source.trim();
          if (!trimmed) throw new Error("`write_mermaid` requires non-empty `source`.");
          mermaidSession = writeBody(GROUP_MERMAID, FILE_MERMAID, trimmed);
          const lines = trimmed.split("\n").length;
          return {
            title: "Write Mermaid",
            output: `Wrote ${lines}-line Mermaid source.\nCall render_mermaid to render it, or edit_mermaid to tweak it.`,
            metadata: { lines, path: mermaidSession.bodyPath },
          };
        },
      }),

      edit_mermaid: tool({
        description:
          "Make a single exact-match replacement in this session's Mermaid source. " +
          "`old_text` must appear EXACTLY ONCE. Call write_mermaid first.",
        args: {
          old_text: schema.string().describe("Exact substring of current source to replace."),
          new_text: schema.string().describe("Replacement text."),
        },
        async execute({ old_text, new_text }: { old_text: string; new_text: string }) {
          if (!mermaidSession || !fs.existsSync(mermaidSession.bodyPath)) {
            throw new Error("edit_mermaid: no source written yet — call write_mermaid first.");
          }
          const current = fs.readFileSync(mermaidSession.bodyPath, "utf8");
          const { updated, index } = applyEdit(current, old_text, new_text);
          fs.writeFileSync(mermaidSession.bodyPath, updated, "utf8");
          return {
            title: "Edit Mermaid",
            output:
              "Applied edit. Updated region:\n```\n" +
              snippetAround(updated, index) +
              "\n```\nCall render_mermaid to verify.",
          };
        },
      }),

      render_mermaid: tool({
        description:
          "Render the CURRENT session Mermaid source to a PNG so you can inspect it. " +
          "Call with no `save_as` to preview. When correct and clean, call with `save_as: '<slug>'` " +
          "to publish the PNG into the Obsidian vault's viz/ directory.",
        args: {
          save_as: schema
            .string()
            .optional()
            .describe("Short kebab-case topic slug (e.g. 'packet-ordering'). Publishes into vault viz/ folder."),
        },
        async execute({ save_as }: { save_as?: string }) {
          if (!mermaidSession || !fs.existsSync(mermaidSession.bodyPath)) {
            throw new Error("render_mermaid: no source yet — call write_mermaid first.");
          }
          const { workDir, bodyPath } = mermaidSession;
          const chrome = findChrome();
          const cfgPath = path.join(workDir, "puppeteer.json");
          fs.writeFileSync(
            cfgPath,
            JSON.stringify(
              chrome ? { executablePath: chrome, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] }
            ),
            "utf8"
          );

          const mmdc = resolveMmdcBin(directory);
          const outPath = path.join(workDir, `render-${Date.now()}.png`);
          const res = await run(
            mmdc,
            ["-i", bodyPath, "-o", outPath, "-p", cfgPath, "-s", "2", "-b", "white"],
            { cwd: workDir, timeoutMs: RENDER_TIMEOUT_MS, env: { PUPPETEER_SKIP_DOWNLOAD: "1" } }
          );

          if (res.code !== 0 || !fs.existsSync(outPath)) {
            const detail = (res.stderr || res.stdout || "unknown error").split("\n").slice(-25).join("\n");
            return {
              title: "Render Mermaid: FAILED",
              output: `Mermaid render failed. Fix syntax with edit_mermaid and re-render.\n\nError:\n${detail}`,
            };
          }

          if (save_as) {
            const published = publishVizImage(outPath, save_as, directory);
            return {
              title: "Render Mermaid: Published",
              output:
                `RESULT:\nfilename: ${published.filename}\npath: ${published.path}\n\n` +
                `Diagram published into Obsidian vault viz folder!\nEmbed in Obsidian lesson with: ![[${published.filename}|500]]`,
              attachments: [
                {
                  type: "file",
                  mime: "image/png",
                  url: `file://${published.path}`,
                  filename: published.filename,
                },
              ],
            };
          }

          return {
            title: "Render Mermaid: Preview",
            output: "Rendered preview successfully. Inspect the diagram carefully for correctness.",
            attachments: [
              {
                type: "file",
                mime: "image/png",
                url: `file://${outPath}`,
                filename: path.basename(outPath),
              },
            ],
          };
        },
      }),

      // ──────────────────────────────────────────────────────────────────────────
      // SVG authoring tools
      // ──────────────────────────────────────────────────────────────────────────
      write_svg: tool({
        description:
          "Write the FULL SVG source to this session's managed file. " +
          "source must be a complete <svg ...>...</svg> document with viewBox/dimensions. " +
          "Writing does NOT render — call render_svg when ready.",
        args: {
          source: schema.string().describe("The complete SVG document from <svg to </svg>."),
        },
        async execute({ source }: { source: string }) {
          const trimmed = source.trim();
          if (!trimmed || !trimmed.includes("<svg")) {
            throw new Error("`write_svg` requires a valid, complete <svg>...</svg> document.");
          }
          svgSession = writeBody(GROUP_SVG, FILE_SVG, trimmed);
          const lines = trimmed.split("\n").length;
          return {
            title: "Write SVG",
            output: `Wrote ${lines}-line SVG source.\nCall render_svg to render it, or edit_svg to tweak it.`,
            metadata: { lines, path: svgSession.bodyPath },
          };
        },
      }),

      edit_svg: tool({
        description:
          "Make a single exact-match replacement in this session's SVG source. " +
          "`old_text` must appear EXACTLY ONCE. Call write_svg first.",
        args: {
          old_text: schema.string().describe("Exact substring of current source to replace."),
          new_text: schema.string().describe("Replacement text."),
        },
        async execute({ old_text, new_text }: { old_text: string; new_text: string }) {
          if (!svgSession || !fs.existsSync(svgSession.bodyPath)) {
            throw new Error("edit_svg: no source written yet — call write_svg first.");
          }
          const current = fs.readFileSync(svgSession.bodyPath, "utf8");
          const { updated, index } = applyEdit(current, old_text, new_text);
          fs.writeFileSync(svgSession.bodyPath, updated, "utf8");
          return {
            title: "Edit SVG",
            output:
              "Applied edit. Updated region:\n```\n" +
              snippetAround(updated, index) +
              "\n```\nCall render_svg to verify.",
          };
        },
      }),

      render_svg: tool({
        description:
          "Render the CURRENT session SVG source to a PNG so you can inspect it. " +
          "Uses rsvg-convert (or magick fallback). When correct and clean, call with `save_as: '<slug>'` " +
          "to publish the PNG into the Obsidian vault's viz/ directory.",
        args: {
          save_as: schema
            .string()
            .optional()
            .describe("Short kebab-case topic slug (e.g. 'vector-addition'). Publishes into vault viz/ folder."),
        },
        async execute({ save_as }: { save_as?: string }) {
          if (!svgSession || !fs.existsSync(svgSession.bodyPath)) {
            throw new Error("render_svg: no source yet — call write_svg first.");
          }
          const { workDir, bodyPath } = svgSession;
          const outPath = path.join(workDir, `render-${Date.now()}.png`);

          // Try rsvg-convert first
          let res = await run("rsvg-convert", ["-z", "2", bodyPath, "-o", outPath], {
            cwd: workDir,
            timeoutMs: RENDER_TIMEOUT_MS,
          });

          // Fallback to ImageMagick if rsvg-convert fails or isn't present
          if (res.code !== 0 || !fs.existsSync(outPath)) {
            res = await run("magick", ["-density", "192", "-background", "white", bodyPath, outPath], {
              cwd: workDir,
              timeoutMs: RENDER_TIMEOUT_MS,
            });
          }

          if (res.code !== 0 || !fs.existsSync(outPath)) {
            const detail = (res.stderr || res.stdout || "unknown error").split("\n").slice(-25).join("\n");
            return {
              title: "Render SVG: FAILED",
              output: `SVG render failed. Fix geometry or syntax with edit_svg and re-render.\n\nError:\n${detail}`,
            };
          }

          if (save_as) {
            const published = publishVizImage(outPath, save_as, directory);
            return {
              title: "Render SVG: Published",
              output:
                `RESULT:\nfilename: ${published.filename}\npath: ${published.path}\n\n` +
                `Diagram published into Obsidian vault viz folder!\nEmbed in Obsidian lesson with: ![[${published.filename}|500]]`,
              attachments: [
                {
                  type: "file",
                  mime: "image/png",
                  url: `file://${published.path}`,
                  filename: published.filename,
                },
              ],
            };
          }

          return {
            title: "Render SVG: Preview",
            output: "Rendered preview successfully. Inspect the geometry carefully for correctness.",
            attachments: [
              {
                type: "file",
                mime: "image/png",
                url: `file://${outPath}`,
                filename: path.basename(outPath),
              },
            ],
          };
        },
      }),
    },
  };
};

export default VisualToolsPlugin;
