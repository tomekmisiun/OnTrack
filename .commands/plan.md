# Command: Plan Tasks

Copy everything below the line into your agent chat.

---

You are working in the **target repository** (see README for project identity).

Break the following work into **small, verifiable tasks**:

**Input (spec, backlog item, or description):**  
<PASTE HERE>

**Instructions:**

1. Read `.ai-rules/planning-and-task-breakdown.md` and `.ai-rules/incremental-work.md`.
2. Use the task card format: title, scope, acceptance criteria, likely files, validation command, dependencies, rollback/safety.
3. Order tasks for safe implementation (data layer → domain → transport → tests → docs).
4. Prefer **one backlog item per PR** when applicable.
5. Do not implement yet unless asked.

Output a numbered task list ready for sequential execution.
