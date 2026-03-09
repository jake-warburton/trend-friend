# AI Foundation Guidelines Repository

A template repository providing universal coding-agent guidelines for consistent, high-quality engineering across all projects.

## Purpose

This repository establishes baseline engineering standards that apply regardless of:

- Programming language or framework
- Project scale (prototype to production)
- Team size
- Domain (web, mobile, CLI, infrastructure)

The guidelines enforce reliable, repeatable practices and serve as the foundation for every new project.

## Files Included

### Main Agent Instructions — Core Guidelines (Always Include)

The primary guidelines file. In this repository, the base template currently lives in `AGENTS.md`, but it is intended to be adapted to the instruction filename your agent expects. It covers:

- **Principles**: DRY, KISS, YAGNI, SOLID, 12-Factor App, security-first mindset
- **Architecture**: Separation of concerns, modular design, layered architecture
- **Project Layout**: Language-agnostic conventions for `src/`, `tests/`, `docs/`, `scripts/`, configuration
- **Documentation**: README requirements, inline docs, keeping docs close to code
- **Testing**: Coverage, determinism, unit/integration/E2E strategies
- **Code Quality**: No dead code, named constants, focused functions, clear naming, error handling
- **Reliability & Repeatability**: Reproducible builds, environment as code, testability, no environment-specific code paths

**Always copy the main instruction file to the root of every new project.** It's the baseline for all work.

### TDD Instructions — Optional Add-On

Covers Test-Driven Development practices. Include this file when using TDD.

- **Red-Green-Refactor Cycle**: Write failing test → minimum code to pass → refactor
- **Test-First Discipline**: One test at a time, tests as design artifacts, never skip failing tests
- **Test Organization**: Naming conventions (`given_when_then`), Arrange-Act-Assert structure
- **Unit Tests**: Speed, isolation, mocking strategy, testing behavior not implementation
- **Integration Tests**: Purpose, setup, coverage strategy
- **Acceptance/E2E Tests**: Validating complete workflows
- **Test Coverage**: Targeting high coverage on business logic, not chasing 100%
- **Test Data**: Factories, mocking time/randomness, database fixtures
- **Refactoring**: Safe refactoring with tests, common pitfalls
- **CI/CD Integration**: Test requirements before merge

**Copy the TDD instruction file to projects using TDD.** It stands alone alongside the main instruction file without duplication.

### `context/business/README.md` & `context/stack/README.md` — Context Templates

Templates for two context directories that hold project-specific information:

- **`context/business/`** — Domain knowledge, business rules, product requirements, user personas, design decisions, compliance rules. Files here take priority over generic guidelines when copied to a real project.
- **`context/stack/`** — Technical stack, cloud architecture, external integrations, CI/CD, service architecture, database schema. Files here document the project's technical environment and constraints.

**Copy both directories to your project.** Then populate them with project-specific files. These become the primary source of truth for your coding agent, overriding generic guidelines where applicable.

See the context `README.md` files for examples and conventions.

### `README.md` (This File)

Explains how to use this repository as a foundation.

## Understanding Context Directories

When you copy this repository to a real project, the two context directories become critical:

1. **`context/business/`** takes priority for domain knowledge, requirements, and business decisions. If a business decision conflicts with a generic guideline, the business context wins.
2. **`context/stack/`** takes priority for technical architecture and infrastructure decisions. If a stack decision conflicts with a generic guideline, the stack context wins.

Your coding agent should read these directories first and apply their contents as overrides to the generic baseline guidelines.

**Example**: The base instruction file says "prefer simple JSON REST APIs." But if `context/stack/service-architecture.md` specifies "all inter-service communication uses gRPC for performance," the agent should follow the context directive.

This separation keeps generic guidelines portable (copy them to any project) while allowing projects to document and enforce their specific constraints.

## How to Use This Repository

### For a New Project

1. **Clone this repository:**

   ```bash
   git clone <this-repo-url> ai-foundation
   ```

2. **Copy the guidelines and context templates to your new project:**

   ```bash
   # Copy the main instruction template and rename it for your agent
   cp ai-foundation/AGENTS.md my-project/AGENTS.md

   # Copy the TDD add-on if using TDD
   cp ai-foundation/AGENTS.tdd.md my-project/AGENTS.tdd.md

   # Copy context directory templates
   cp -r ai-foundation/context my-project/context
   ```

3. **Populate the context directories:**
   - Create files in `context/business/` for domain knowledge, requirements, and business rules (see `context/business/README.md` for examples)
   - Create files in `context/stack/` for technical architecture, cloud setup, and integrations (see `context/stack/README.md` for examples)
   - Example files to start with: `context/business/domain-model.md`, `context/business/design-decisions.md`, `context/stack/ci-cd.md`, `context/stack/aws.md`

4. **Commit the guidelines and context:**

   ```bash
   cd my-project
   git add AGENTS.md AGENTS.tdd.md context/
   git commit -m "Add agent guidelines and context directories"
   ```

5. **Customize (optional):**
   - Extend your main instruction file with project-specific rules after the base content, or use `context/business/` and `context/stack/` files instead.
   - Add project-specific rules to context directories rather than modifying the base template.
   - Example: If all services must use gRPC, document it in `context/stack/service-architecture.md`.
   - Example: If the project enforces Prettier, document it in `context/stack/tooling.md`.
   - Never remove or contradict the base guidelines; extend them via context directories or new sections.

### For an Existing Project

1. **Copy the main instruction file to the root:**

   ```bash
   cp ai-foundation/AGENTS.md my-existing-project/AGENTS.md
   ```

2. **If using TDD, copy the TDD add-on:**

   ```bash
   cp ai-foundation/AGENTS.tdd.md my-existing-project/AGENTS.tdd.md
   ```

3. **Reference additional guidelines in your main instruction file (optional):**
   - At the end of that file, add:
     ```markdown
     @AGENTS.tdd.md
     ```
     This tells agents that support file inclusion to also read the TDD guidelines when working on the project.

4. **Commit and integrate.**

## Customization Guide

### When to Extend

The base guidelines intentionally avoid language/framework-specific details. Extend them to add:

- **Language/Framework conventions**: Go formatting, Python naming, JavaScript async patterns, etc.
- **Project-specific practices**: Required architectural patterns, deployment procedures, secret management, etc.
- **Team agreements**: Code review process, PR size limits, on-call procedures, etc.

### How to Extend

Add sections after the base content, clearly marked as project-specific:

```markdown
# AI Foundation Guidelines

[... base content ...]

---

## Project-Specific Extensions

### Language & Framework

- All code follows [Language] conventions via [Tool] (e.g., `gofmt`, `prettier`).
- Async code uses [Pattern] (e.g., async/await, Promises).
- Error types extend `BaseError` and include a unique code for tracking.

### Architecture

- All services use gRPC for inter-service communication; REST only for external APIs.
- Database schema changes require a migration file in `migrations/`.

### Testing

- Integration tests use Docker containers for all stateful services.
- Every public API endpoint must have at least one E2E test.

### Deployment

- Secrets are stored in [Service] and injected as env vars; never hardcoded.
- All deployments must run through CI/CD; manual deployments are not allowed.
```

### Anti-Patterns in Customization

- ❌ **Don't override the base**: Rewriting or contradicting the base instruction file defeats its purpose.
- ❌ **Don't add subjective style**: "Use camelCase" is redundant if language conventions already dictate it.
- ❌ **Don't document what code shows**: If a `README.md` template exists in the repo, don't repeat it.
- ✅ **Do extend with specifics**: "Database migrations use [Tool] in `migrations/`" is a valid project rule.

## Reference & Integration

### Using These Guidelines in Your Project

Once copied, configure your agent to read the main instruction file at the start of each session. If your setup supports file references and you also have a TDD add-on, reference it from the main file:

```markdown
# AI Foundation Guidelines

@AGENTS.tdd.md

[... rest of AGENTS.md ...]
```

Your agent will then load both files and apply the combined guidelines to all work.

### Structure of Guidelines

Both files are organized to avoid duplication:

- The main instruction file covers universal principles and practices.
- The TDD add-on covers TDD-specific details that complement, not replace, the testing section in the main instruction file.

You can safely use both files together; they're designed to do so.

## Verification Checklist

Before distributing guidelines to your team:

**Base Files**

- ✅ A root instruction file is present and includes the "Source of Truth" section at the top.
- ✅ If using TDD, the TDD add-on file is present and referenced where supported.

**Context Directories**

- ✅ `context/business/` exists with a populated `README.md` explaining its purpose.
- ✅ `context/stack/` exists with a populated `README.md` explaining its purpose.
- ✅ Both directories contain relevant project-specific files (e.g., `domain-model.md`, `design-decisions.md`, `ci-cd.md`, `aws.md`).

**Quality & Consistency**

- ✅ No language/framework-specific sections in the base template; they belong in `context/` directories.
- ✅ All project-specific rules are in context directories, not mixed into the base instruction file.
- ✅ No contradictions between the base instruction file and context files; context overrides are intentional.
- ✅ README exists in the project and documents setup/run procedures.
- ✅ No dead code, commented-out blocks, or TODOs in the guidelines or context files.

## Structure of This Repository

```
ai-foundation/
├── context/
│   ├── business/
│   │   └── README.md   # Template: what belongs in context/business/ (copy when creating project)
│   └── stack/
│       └── README.md   # Template: what belongs in context/stack/ (copy when creating project)
├── AGENTS.md           # Base instruction template; rename per agent conventions when copying
├── AGENTS.tdd.md       # TDD add-on template; rename per agent conventions when copying
└── README.md           # This file; explains how to use the template
```

This repository is minimal by design. It's meant to be cloned, its files copied elsewhere, and then used as a reference. It does not contain project code, CI/CD workflows, or environment-specific configuration.

## Questions?

Refer to the guideline templates themselves (`AGENTS.md`, `AGENTS.tdd.md`) for detailed rationales and examples. The guidelines are written to be self-contained and clear.

For questions about using these files in your project, consult the documentation for the coding agent you use and rename the templates to match that agent's conventions.

---

**Last Updated**: 2026-03-06
**Version**: 1.0
**Maintained by**: AI Foundation Initiative
