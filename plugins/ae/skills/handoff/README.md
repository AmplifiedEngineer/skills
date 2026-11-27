# Handoff

Save a session handoff for the next session, or load the saved one and check it against the repo.

Install this directory as handoff under .claude/skills/, .agents/skills/, or ~/.agents/skills/. Read SKILL.md first and use the template it names.

The skill needs git, and uses the GitHub CLI (gh) when present. It saves to .ae/handoff.md and does not change code. Loading runs when you ask, since there is no session-start hook.
