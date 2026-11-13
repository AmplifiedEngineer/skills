# Engineering Skills V2

A three-skill suite for architecture, implementation and project context. Skills can be installed independently.

- Planner: requirements discovery, architecture reconstruction and design, reviews, impact and drift analysis, documentation management, and implementation handover.
- Implementer: scoped code changes, focused verification, architecture compliance and implementation reporting.
- Researcher: project information retrieval and explicitly requested synchronization across configured repositories and engineering systems.

Architect owns architectural decisions, Implementation owns code changes, and Context owns provider-neutral information acquisition and external-system synchronization.

## Install

Copy the desired skill directory into one of these locations:

- Claude Code, project-level: .claude/skills/<skill-name>/
- Codex, project-level: .agents/skills/<skill-name>/
- Codex, user-level: ~/.agents/skills/<skill-name>/

The shared SKILL.md and supporting files work across both environments. The agents/openai.yaml file is optional Codex UI metadata. Discover integrations actually available in the environment; example provider names do not configure access.

No licence terms were supplied, so this package does not include a LICENSE file.
