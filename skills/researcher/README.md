# Researcher

Gather and organize project information from repositories and configured engineering systems, or prepare an explicitly requested synchronization.

Call it directly: `/ae:researcher` in Claude Code, `$researcher` in Codex. The planner and implementer also call it when they need information. It answers first, then lists its sources with links and dates.

Install this directory as researcher under .claude/skills/, .agents/skills/, or ~/.agents/skills/. Read SKILL.md first and load only relevant workflows and references.

The optional hints file is described in references/hints-file.md.

Example provider values do not configure credentials or grant access. The skill discovers integrations at runtime.
