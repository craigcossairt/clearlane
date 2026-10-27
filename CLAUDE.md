# CLAUDE.md

@AGENTS.md

Claude Code specifics (everything above is harness-agnostic):

- Two Claude Code sessions work here: Integration in this main checkout (`docs/lanes/integration.md`) and
  Engine in `../clearlane-engine` (`docs/lanes/engine.md`). Read your lane brief before anything else.
- Hooks in `.claude/settings.json` block edits to secrets and lock files and format on save. They are the same
  scripts the Cursor, Grok and Codex adapters run.
- Large and third-party files live in `../clearlane-raw/` (local only). Never copy them into the repo.
