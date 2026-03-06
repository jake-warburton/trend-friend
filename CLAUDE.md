# AI Foundation Guidelines

These guidelines ensure consistent, high-quality engineering across all projects, regardless of language, tech stack, or scale. They are enforced by Claude Code and serve as the first design artifact for reliable, repeatable results.

## Source of Truth

When you copy this file to a real project, **always** create two context directories in the project root:

- **`context/business/`** — Project-specific domain knowledge, business rules, product requirements, and design decisions
- **`context/stack/`** — Technical architecture, infrastructure, cloud setup, external integrations, and deployment procedures

**These directories take priority over these generic guidelines.** If a file in `context/business/` or `context/stack/` specifies an approach that conflicts with the guidelines below, follow the context directory's guidance.

Claude Code will read these directories automatically at the start of each session. Treat them as the primary source of truth for your project. Generic guidelines are defaults; context directories are overrides.

See `context/business/README.md` and `context/stack/README.md` for what to put in each.

---

## Principles

### DRY, KISS, YAGNI
- **DRY (Don't Repeat Yourself)**: Eliminate duplication of logic, configuration, and structure. Repeated code is a liability.
- **KISS (Keep It Simple, Stupid)**: Favor clarity over cleverness. Code is read far more often than it is written. Avoid premature optimization and over-engineering.
- **YAGNI (You Aren't Gonna Need It)**: Don't build what isn't needed yet. Solve today's problem, not tomorrow's speculative one.

### SOLID Principles
- **Single Responsibility**: Each module, class, or function has one reason to change.
- **Open/Closed**: Open for extension, closed for modification. Use interfaces and composition over inheritance.
- **Liskov Substitution**: Derived classes must be substitutable for their base classes without breaking behavior.
- **Interface Segregation**: Depend on small, focused interfaces rather than fat, general-purpose ones.
- **Dependency Inversion**: Depend on abstractions, not concretions. Inject dependencies; don't hardcode them.

### 12-Factor App Principles
- Environment configuration via env vars, not hardcoded values or separate config files for each environment.
- Stateless processes: no in-memory session storage that ties requests to specific instances.
- Explicit, pinned dependencies: use lockfiles; reproducible builds are non-negotiable.
- Structured logging: logs are event streams, not strings; make them machine-parseable.

### Security-First Mindset
- Validate **all input** at system boundaries (user input, external APIs, file uploads). Never trust external data.
- Apply least privilege: processes run with minimum required permissions; databases use limited service accounts.
- Be aware of OWASP top vulnerabilities: injection, broken auth, sensitive data exposure, XML attacks, broken access control, security misconfiguration, XSS, insecure deserialization, using components with known vulnerabilities, insufficient logging.
- Secrets (API keys, passwords, tokens) are never committed or logged. Use env vars or secret management systems.
- Fail securely: don't leak information in error messages; log security events; never silently ignore suspicious activity.

---

## Architecture

### Separation of Concerns
- **No business logic in UI layers**: UI code handles rendering, form handling, routing. Business rules live in services/models.
- **No database queries in controllers/handlers**: Controllers orchestrate; services fetch and transform data.
- **No infrastructure code mixed with logic**: Persistence, HTTP clients, and external service calls are decoupled behind interfaces.
- Clear boundaries make systems testable, maintainable, and replaceable.

### Modular Design
- Components/modules should be independently testable and, ideally, replaceable without changing dependent code.
- Define clear interfaces or contracts between modules. Implementation details are hidden.
- Minimize coupling: changes to one module shouldn't force changes across the codebase.
- Use composition over inheritance; prefer small, focused classes/functions over large hierarchies.

### Layered Architecture (Language-Agnostic)
- **Presentation/API Layer**: HTTP handlers, request validation, response formatting. Thin; delegates to services.
- **Service/Business Layer**: Core logic, workflows, rules. No framework or database knowledge.
- **Data/Persistence Layer**: Database queries, migrations, ORM models. Abstracted behind repository/data access interfaces.
- **External Integrations**: Third-party APIs, message queues, caches. Abstracted behind clean interfaces.

Each layer depends inward; outer layers never directly call inner layers. Use dependency injection to wire dependencies.

---

## Project Layout (Language-Agnostic Conventions)

```
my-project/
├── src/ (or app/)                    # Source code
│   ├── handlers/                     # HTTP/API handlers, routers
│   ├── services/                     # Business logic, workflows
│   ├── models/                       # Data models, schemas
│   ├── repositories/                 # Data access (abstracted)
│   ├── utils/                        # Shared utilities, helpers
│   └── config/                       # Configuration, env parsing
├── tests/ (or test/)                 # Test suite
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── e2e/ (optional)               # End-to-end tests
├── docs/                             # Documentation
│   ├── API.md                        # API reference
│   ├── ARCHITECTURE.md               # High-level design
│   └── ...
├── scripts/                          # Utility scripts, migrations, seeders
├── .env.example                      # Example environment variables (no secrets)
├── README.md                         # Project overview, setup, how to run
├── CLAUDE.md                         # AI guidelines (this file, if project-specific additions exist)
├── CLAUDE.tdd.md                     # TDD guidelines (if using TDD)
└── [Dependency manifest]             # package.json, Gemfile, go.mod, Cargo.toml, etc.
```

- **Source code** in `src/` or `app/` with clear layer separation.
- **Tests** in `tests/` or alongside source (language convention).
- **Config/env files** at root; `.env.example` documents all required variables (never commit actual `.env`).
- **Docs** in `docs/`; README at root.
- **Scripts** in `scripts/` (migrations, seeds, dev setup, etc.).

---

## Documentation

### README (Required)
Every project must have a root `README.md` containing:
1. **Purpose**: What does this project do? Why does it exist?
2. **Quick Start**: How to clone, install dependencies, and run locally.
3. **Running Tests**: How to run the test suite.
4. **Project Structure**: Brief overview of directory layout and key modules.
5. **Configuration**: Required env vars, how to set them, examples.
6. **Contributing** (if applicable): Code style, PR process, running builds locally.

### Inline Documentation
- Document the **why**, not the **what**. Code shows what it does; comments explain non-obvious decisions, trade-offs, and context.
- Keep docs close to code. Update docs when code changes.
- Architecture decisions should live in `docs/ARCHITECTURE.md` or similar; link from README.

### Anti-Patterns
- No outdated docs; remove or update rather than let them drift.
- No obvious comments: `i++` doesn't need explanation.
- No commented-out code blocks; use version control instead.

---

## Testing (Baseline)

### Coverage
- All new code must have tests before merging.
- Aim for high unit test coverage on business logic; don't chase 100% on glue code and simple getters.
- Integration tests validate contracts between layers.
- E2E tests (optional but encouraged) validate user workflows end-to-end.

### Determinism & Isolation
- Tests must be **deterministic**: same input always produces the same result.
- No random data in assertions; use fixed test data.
- No time-dependent assertions without mocking `now()`, `Date.now()`, etc.
- No network calls in unit tests; mock external services.
- Tests must be **independently runnable** in any order; no shared state, no test pollution.

### Testing Strategy
- **Unit tests**: Fast, isolated, mock all I/O. Test functions and methods in isolation.
- **Integration tests**: Verify contracts between components (e.g., service ↔ repository). May use test databases.
- **E2E tests**: Validate user behavior end-to-end. Run against a real (or containerized) environment.
- Prefer explicit assertions over implicit ones; test **behavior**, not implementation details.

### CI/CD
- All tests must pass in CI before merging to main.
- CI configuration is code and reviewed like any other change.
- Failed tests block merge; no exceptions without explicit team agreement.

---

## Code Quality

### No Dead Code
- Remove unused functions, variables, imports, and branches.
- Dead code is a liability: it rots, misleads, and adds maintenance burden.
- Use version control; there's no need to keep commented-out code.

### Named Constants
- No magic numbers or strings. `MAX_RETRIES = 3` instead of `3` scattered through code.
- Magic values hide intent and make changes error-prone.

### Function Design
- Functions do **one thing**. If a function needs a paragraph-long comment to explain what it does, refactor it.
- Prefer many small, focused functions over few large ones.
- Function names should be clear: `validate_email` not `check`.

### Error Handling
- **Fail fast and loud**: Errors surface immediately and clearly, not buried in logs.
- Never silently swallow exceptions or continue on errors that should stop execution.
- Errors should include context: what failed and why (but no sensitive data in messages).
- Let errors propagate up; don't catch them unless you can actually handle them.

### Naming Conventions
- Follow language conventions consistently (camelCase, snake_case, PascalCase, etc.).
- Names should be descriptive and unambiguous. `users_by_email` beats `u_hash`.
- Abbreviations only for widely understood conventions (e.g., `id`, `api`, `db`).

---

## Reliability & Repeatability

### Reproducible Builds
- Pin all dependency versions in lockfiles (`package-lock.json`, `go.sum`, `Cargo.lock`, etc.).
- Lock files are committed to version control.
- Builds must produce identical output across machines and time.

### Environment as Code
- Define environments via files committed to version control: `Dockerfile`, `.tool-versions`, `.nvmrc`, etc.
- Database migrations are code; apply them as part of deployment.
- Infrastructure changes (Terraform, CloudFormation, etc.) are reviewed like code.

### Testability & Mocking
- All external side effects (database, HTTP, filesystem) must be mockable or replaceable in tests.
- Use interfaces/contracts to abstract I/O; inject dependencies.
- Tests should not require real services (database, API); use stubs or containerized services in CI.

### No Environment-Specific Code Paths
- Never hardcode environment detection (`if NODE_ENV === 'production'`).
- Use configuration and feature flags instead. Same code runs everywhere; config determines behavior.
- This ensures production is tested the same way as development.

---

## Summary

These guidelines prioritize **clarity, testability, security, and maintainability** over cleverness or premature optimization. They apply across all tech stacks and project sizes. Enforce them consistently:

1. **Principles first**: DRY, KISS, YAGNI, SOLID, 12-Factor, security-first.
2. **Clear architecture**: Separation of concerns, modular design, layered structure.
3. **Comprehensive testing**: Unit, integration, and E2E; deterministic and isolated.
4. **Code quality**: Named constants, small focused functions, clear naming, explicit error handling.
5. **Reproducibility**: Pinned dependencies, environment as code, no magic paths.

When in doubt, ask: *Is this change reducing complexity or adding to it? Is it testable? Is it secure? Would someone else understand why it's here?*
