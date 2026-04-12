# Three Man Team — Session Router

## Package Manager

**Use `npm`, not `pnpm`.** The project uses npm workspaces (`package-lock.json`).
Never run `pnpm install` or any `pnpm` command — it generates a `pnpm-lock.yaml`
that should not be committed.

```
npm install              # install deps
npm run test -w @kicable/client   # run workspace tests
npm run build            # build all
```

## Token Rules — Always Active

```
Is this in a skill or memory?   → Trust it. Skip the file read.
Is this speculative?            → Kill the tool call.
Can calls run in parallel?      → Parallelize them.
Output > 20 lines you won't use → Route to subagent.
About to restate what user said → Delete it.
```

Grep before Read. Never read a whole file to find one thing.
Do not re-read files already in context this session.

---

## Session Start — Every Role

1. Load your token-optimizer skill if you have one — first, before anything else.
2. Check `SESSION-CHECKPOINT.md` — if active and recent, read it. That is your state.
3. Load your role file from `.claude/agents/`:
   - `.claude/agents/ARCHITECT.md` · `.claude/agents/BUILDER.md` · `.claude/agents/REVIEWER.md`
4. If no checkpoint — Architect reads `BUILD-LOG.md` + `ARCHITECT-BRIEF.md` only.

**Project Owner role is set by the human. Do not ask.**

---

## Reference Files — On Demand Only

| File | Load when |
|---|---|
| Project spec | Architect needs it; checkpoint doesn't cover it |
| ARCHITECT-BRIEF.md | Builder and Reviewer load at task start |
| BUILD-LOG.md | Architect checks status; Builder updates when done |
| REVIEW-REQUEST.md | Reviewer loads at review start |
| REVIEW-FEEDBACK.md | Builder loads after Reviewer signals done |

---

## Handoff Files

All team communication flows through files in `handoff/`:
- `ARCHITECT-BRIEF.md` — Architect writes, Builder reads
- `REVIEW-REQUEST.md` — Builder writes, Reviewer reads
- `REVIEW-FEEDBACK.md` — Reviewer writes, Builder reads
- `BUILD-LOG.md` — shared record, Architect owns
- `SESSION-CHECKPOINT.md` — Architect writes at session end
