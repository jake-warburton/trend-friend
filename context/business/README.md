# Business & Domain Context

This directory contains project-specific business domain knowledge, requirements, and design decisions that override or extend the generic guidelines in `CLAUDE.md`.

## Purpose

When copied to a real project, files in this directory become the **primary source of truth** for Claude Code. They take precedence over generic engineering guidelines where there is overlap or conflict. They communicate:

- **Product & domain knowledge**: What the project does, its business purpose, target users
- **Business rules**: Domain-specific logic, policies, constraints that shape architecture
- **Product requirements**: Features, user personas, acceptance criteria, non-functional requirements
- **Design decisions**: Why certain architectural choices were made, trade-offs accepted, constraints respected
- **Glossary & terminology**: Domain-specific language to ensure consistent naming

## What to Put Here

Create one file per topic. Examples:

### `domain-model.md`
- Core domain concepts and entities
- Business rules and invariants
- Example: "An Order cannot transition from Pending to Completed without Payment being Confirmed first"

### `requirements.md`
- Feature specifications and user stories
- Acceptance criteria
- Non-functional requirements (performance, scalability, compliance)
- Example: "All payment data must be PCI-compliant; never store card numbers"

### `user-personas.md`
- Target users and their needs
- Common workflows and pain points
- Example: "Admin user needs to bulk-import 10K vendors with validation"

### `design-decisions.md`
- ADRs (Architecture Decision Records) or design rationales
- Alternative approaches considered and rejected
- Trade-offs and constraints
- Example: "We chose PostgreSQL over MongoDB because of ACID guarantees and complex join requirements"

### `glossary.md`
- Domain-specific terms and their definitions
- Acronyms used in the project
- Example: "SKU: Stock Keeping Unit, uniquely identifies a product variant"

### `security-policy.md`
- Compliance requirements (GDPR, HIPAA, SOC2, etc.)
- Data classification and handling rules
- Example: "PHI (Protected Health Information) must be encrypted at rest and in transit"

## Convention

- Use **kebab-case** filenames (`domain-model.md`, not `DomainModel.md`)
- Keep files **focused and readable**: one topic per file, 500-2000 lines max
- Link between files when there are dependencies
- Update these docs when business context changes
- Keep examples concrete, not abstract

## Optional: Defining Claude's Role in Your Project

Create an optional file `llm-context.md` or `llm-role.md` to describe how Claude should approach work in your project. This helps Claude understand the business priorities and constraints.

Example:
```markdown
# Claude's Role in This Project

- Prioritize user experience and accessibility; we serve customers with diverse abilities
- When suggesting features, consider our mission to serve non-profit organizations (budget constraints matter)
- For domain modeling, refer to our Glossary for terminology; domain language is critical for stakeholder alignment
- When uncertain about business logic, err on the side of asking rather than guessing
```

This file helps Claude make decisions that align with your business values and priorities.


## How Claude Uses These Files

Claude Code reads files in `context/business/` at the start of each session and treats them as overrides to generic guidelines. If a generic guideline conflicts with something documented here, the business context wins.

**Example**: CLAUDE.md says "use a REST API." But if `design-decisions.md` documents "We use GraphQL for our public API because of client flexibility," Claude follows the documented decision.

## Link from CLAUDE.md

In your project's `CLAUDE.md`, add a reference to this directory:

```markdown
## Source of Truth

Check `context/business/` and `context/stack/` first; they override generic guidelines.
See those directories for project-specific context.
```

Claude will then load these files automatically.
