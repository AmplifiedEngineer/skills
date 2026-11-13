# Architecture Knowledge Model

## Entities

- System
- Component
- Module
- Interface
- Dependency
- Integration
- Data entity
- Requirement
- Constraint
- Decision
- Risk
- Technical debt
- Test
- Document

## Relationships

- CONTAINS
- DEPENDS_ON
- IMPLEMENTS
- EXPOSES
- CONSUMES
- PRODUCES
- PERSISTS
- PROTECTS
- VALIDATES
- DOCUMENTS
- JUSTIFIES
- SUPERSEDES

## Traceability

Requirements should connect to relevant decisions.
Decisions should connect to affected components.
Components should connect to interfaces and dependencies.
Requirements and components should connect to validation evidence.
Documents should identify the architecture they describe.

## Authority

Repository implementation is evidence of current implementation.
Approved architecture decisions establish intended design.
Requirements establish expected behaviour.
Documentation describes the system but may be outdated.

Never treat the model as an independent source of truth.
