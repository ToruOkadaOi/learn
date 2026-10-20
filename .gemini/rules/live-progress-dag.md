# Rule: Live Dependency Graph Progress Tracker

In Phase 3 (Teach loop), whenever a node check is confirmed:
1. Always output an updated Mermaid dependency DAG showing real-time progress.
2. Use standard progress classes:
   - `:::done` with `[✓]` for mastered nodes.
   - `:::active` with `[▶]` for the current/next node being tackled.
   - `:::pending` for unvisited nodes.
3. If an active lesson note is linked in Obsidian, update the diagram in the note (or output the snippet to mirror into the log) so the learner sees their live progress at all times.

Standard classes:
```mermaid
    classDef done fill:#1b4332,stroke:#2d6a4f,stroke-width:2px,color:#d8f3dc;
    classDef active fill:#78350f,stroke:#d97706,stroke-width:2px,color:#fef3c7;
    classDef pending fill:#1f2937,stroke:#374151,stroke-width:1px,color:#9ca3af;
```
