# Engineering Architect V2

A platform-neutral Agent Skill for engineering discovery, architecture reconstruction, solution design, architecture reviews, change impact and drift analysis, documentation management, and implementation handover.

## Package contents

- `SKILL.md` is the short entry point and workflow router.
- `agents/openai.yaml` contains optional Codex presentation metadata.
- `workflows/` contains eight independently loadable procedures.
- `references/` contains seven supporting knowledge modules.
- `templates/` contains seven reusable engineering deliverable structures.
- `examples/architecture-finding.md` demonstrates a finding format.

The workflows and references use relative paths within this package. Load only the workflow and supporting material relevant to the current task.

## Install

Copy the `engineering-architect` directory into one of these locations:

- **Claude Code, project-level:** `.claude/skills/engineering-architect/`
- **Codex, project-level:** `.agents/skills/engineering-architect/`
- **Codex, user-level:** `~/.agents/skills/engineering-architect/`

The shared `SKILL.md` and supporting files are the implementation for both products. Codex can load the skill without `agents/openai.yaml`; that file only supplies optional UI metadata.

## Use

Invoke the skill for architecture work or let the host select it from its description. State the system, change or design question and the expected output. For existing systems, provide the relevant repository context and any authoritative requirements or decisions.

This skill provides architectural reasoning and artefacts. It does not implement code or assume that external integrations are configured. Delegate implementation or engineering-system integration work when the corresponding capability is available; otherwise provide a clear handover.

## Licence

No licence terms were supplied with this package, so no `LICENSE` file is included.
