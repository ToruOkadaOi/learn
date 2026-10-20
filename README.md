# learn (OpenCode / AGY + Obsidian)

An AI learning system based on the principles from Amos Blomqvist's video [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU), engineered for **[OpenCode](https://opencode.ai)** and **Google Antigravity (`agy`)** with live **[Obsidian](https://obsidian.md)** note-taking.

Rather than giving you memorized facts or passive summaries, this system acts as a rigorous personal tutor. It maps the frontier of your current understanding, derives new knowledge from unconditional ground truths, and mirrors every lesson live into an Obsidian note with native LaTeX math, callouts, and verified diagrams.

---

## Architecture & Features

- **Pedagogical System (`skills/teach`)**:
  - **Principle 1 — Unconditional truths first:** Locks in caveat-free foundations before building higher concepts.
  - **Principle 2 — Motivated discovery:** Answers *"how could I have discovered this?"* (3Blue1Brown style), moving from tension to formulation.
  - **3-Phase Workflow:** Binary-search **Probe** $\to$ DAG Dependency **Plan** $\to$ Node-by-node **Teach** loop.
  - **Live Dependency Progress Sync:** Real-time visual tracking on the Mermaid DAG as nodes are mastered (green `[✓]` for done, amber `[▶]` for active).
- **Interactive Question Modals (OpenCode & AGY)**:
  - Supports both OpenCode's `question` tool and Antigravity's `ask_question` tool.
  - **Strict Anti-Spoiler Guardrail:** Zero `(Recommended)` labels—questions feature parallel bare-claim options, an explicit *"I don't know"* choice to prevent guessing, and immediate feedback.
- **Subagents (`.opencode/agents/` & Antigravity)**:
  - `@researcher`: Fact-checking specialist using web search to prevent AI hallucinations.
  - `@mermaid-maker`: Authors and visually inspects structural/relational diagrams.
  - `@svg-maker`: Authors and visually inspects coordinate-precise geometric and vector SVGs.
- **Live Obsidian Synchronization (`.opencode/plugins/obsidian-logger.ts`)**:
  - Real-time logging of discussions into your Obsidian vault.
  - Formats output with Obsidian callouts (`> [!abstract]`, `> [!quote]`, `> [!question]`, `> [!success]`).
  - Native LaTeX math (`$...$` and `$$...$$`) and image embeds (`![[viz-....png|500]]`).
  - Saves diagrams into a dedicated `<vault>/viz/` folder.

---

## Setup & Requirements

### Prerequisites
1. **Runner of Choice**:
   - **[OpenCode](https://opencode.ai)**:
     ```bash
     npm i -g @opencode/cli@latest
     # or via brew:
     # brew install anomalyco/tap/opencode-v2
     ```
   - **Antigravity CLI (`agy`)**: Configured via workspace [`GEMINI.md`](GEMINI.md) and [`.gemini/rules/`](.gemini/rules/).
2. **[Obsidian](https://obsidian.md)** (recommended for reading lesson notes).
3. **Diagram Renderers** (for visual makers):
   - Chromium-based browser (Google Chrome, Chromium, Vivaldi, Brave, Edge, or Arc).
   - SVG tools: `brew install librsvg imagemagick` (provides `rsvg-convert` and `magick`).

### Installation
Clone this repository into your workspace:

```bash
git clone https://github.com/ToruOkadaOi/learn.git
cd learn
npm install
```

---

## Configuring Your Obsidian Vault

The system dynamically resolves your Obsidian vault in this order of precedence:
1. **Environment Variable:** Set `OBSIDIAN_VAULT_PATH` in your shell or `.env`:
   ```bash
   export OBSIDIAN_VAULT_PATH="~/Documents/MyVault/Learn"
   ```
2. **Project Config:** Edit `obsidianVault` in `.opencode/opencode.jsonc`:
   ```jsonc
   {
     "obsidianVault": "~/Documents/MyVault/Learn"
   }
   ```
3. **Slash Command Argument:** Pass an explicit path to `/log` (e.g. `/log ~/Documents/MyVault/Learn/calculus`).
4. **Current Workspace Fallback:** Defaults to `./` and `./viz/`.

---

## How to Learn with It

### Option A: Using OpenCode
1. **Launch OpenCode** in the repository root:
   ```bash
   opencode
   ```
2. **Start a Live Obsidian Lesson Log**:
   ```
   /log tcp-ip-foundations
   ```
   Open `tcp-ip-foundations.md` in Obsidian in **Live Preview** or **Reading View**.
3. **Prompt the Agent**:
   > *"I want to understand how the internet routes packets reliably without losing data."*

### Option B: Using Antigravity (`agy`)
1. **Launch `agy`** in the repository root:
   ```bash
   agy
   ```
2. Antigravity automatically detects [`GEMINI.md`](GEMINI.md) and [`.gemini/rules/`](.gemini/rules/) for anti-spoiler questions and live DAG progress tracking.
3. Prompt the agent with your topic to start the 3-phase learning session!

### The Learning Loop:
- Answer diagnostic probes in the interactive question modal (unbiased, zero spoiler labels).
- Review and approve the dependency DAG plan.
- Step through each concept node-by-node with real-time visual progress updates on the dependency map!
