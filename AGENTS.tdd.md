# Test-Driven Development (TDD) Guidelines

Use this document alongside your main agent instruction file for projects adopting Test-Driven Development. TDD inverts the traditional workflow: tests are written first, then production code. This enforces good design, comprehensive coverage, and confidence in refactoring.

## Core TDD Workflow

### Red-Green-Refactor Cycle
1. **Red**: Write a failing test for the behavior you want to implement. The test should be as specific as possible.
2. **Green**: Write the **minimum code** required to make the test pass. Don't over-engineer; just make it work.
3. **Refactor**: Improve the code while keeping tests passing. Refactor tests and production code together.

Repeat for each feature or behavior. Keep the feedback loop tight; run tests frequently.

### Golden Rule
**Never write production code without a failing test driving it.** Every line of production code should exist because a test required it.

---

## Test-First Discipline

### One Test at a Time
- Write one failing test, make it pass, then write the next.
- This keeps you focused and prevents scope creep.
- If a test is hard to write, the design is probably wrong—redesign before proceeding.

### Tests as the First Design Artifact
- Tests document what the code should do.
- If a design is hard to test, refactor the design, not the test.
- Write tests that describe behavior in business terms, not implementation details.

### Never Skip or Comment Out Failing Tests
- If a test fails, fix it or delete it. Commented-out tests are debt.
- Skipped tests (`@skip`, `@pending`) hide problems and encourage forgetting about them.
- If a test is temporarily failing, mark it clearly and fix it immediately, or remove it.

---

## Test Organization

### Test Naming Convention
Use descriptive names that read like a specification. Common pattern: `given_<context>_when_<action>_then_<expected>`

Examples:
- `given_empty_cart_when_checkout_then_error`
- `given_valid_email_when_register_then_user_created`
- `given_insufficient_balance_when_withdraw_then_transaction_rejected`

Alternative patterns (pick one and use consistently):
- `should_<behavior>_when_<condition>`
- `<class_or_function>_<behavior>_<condition>`

The name should read as a mini-specification without looking at the test body.

### Test Structure
Follow **Arrange-Act-Assert** (AAA):
```
Test: given_user_is_admin_when_delete_account_then_permission_denied

Arrange: Create a user with admin role
Act:     Attempt to delete that account
Assert:  Verify action is rejected with permission error
```

Keep tests focused: one logical assertion per test. Multiple assertions are OK if they verify a single outcome.

---

## Unit Tests

### Speed & Isolation
- Unit tests must be **fast**: milliseconds, not seconds. Developers run them hundreds of times per session.
- Unit tests must be **isolated**: no dependencies on filesystem, database, network, or other tests.
- Mock or stub all external dependencies (API calls, database queries, timers, random data).

### Mock Strategy
- **Mocks**: Verify that a function called a dependency correctly. Use sparingly; they test interactions, not behavior.
- **Stubs**: Replace dependencies with fixed implementations. Use for fast, predictable test data.
- **Fakes**: Real, simplified implementations (e.g., in-memory database instead of PostgreSQL). Preferred over mocks when possible.

Example:
```
Unit test: given_user_exists_when_fetch_profile_then_return_user
- Stub the database: return a fixed user object
- Call the service
- Assert the service returned the expected user
- No real database access; no network; instant
```

### No Implementation Details
- Test **behavior**, not implementation. Don't assert that `cache.get()` was called.
- Change the implementation (e.g., caching strategy) without rewriting tests.
- Avoid testing private methods or internal state; test public interfaces.

---

## Integration Tests

### Purpose
Integration tests verify contracts between components. They test that layers communicate correctly:
- Service ↔ Repository (business logic ↔ data access)
- Service ↔ External API (orchestration ↔ third-party)
- Handler ↔ Service (HTTP ↔ business logic)

### Setup
- Use **real databases** in containers (Docker, testcontainers) or an in-memory equivalent.
- Seed test data before each test; clean up after (or use transactions that roll back).
- Keep them deterministic: same test data, same setup, same assertions.

### Coverage
- Integration tests are slower than unit tests, so be selective. Test critical workflows.
- Don't integration-test every single method; focus on cross-layer communication.
- One integration test might replace 5-10 unit tests by verifying the full flow end-to-end.

---

## Acceptance / End-to-End (E2E) Tests

### Purpose
E2E tests validate complete user workflows. They treat the entire system as a black box:
- User logs in, performs an action, sees the result.
- An API client makes requests, receives responses, can chain requests.
- A browser opens a page, clicks buttons, submits forms, reads the result.

### Scope
- Fewer E2E tests than unit or integration tests (they're slow).
- Focus on critical user journeys and happy paths.
- Use E2E tests to catch integration failures across frontend, backend, database, external services.

### Tools & Environment
- Use appropriate tools: Selenium, Cypress, Playwright for UI; REST/GraphQL clients for APIs.
- Run against a real (or containerized) environment: production-like config, real database schema, real service dependencies.
- E2E tests are your safety net; they should run in CI on every PR.

---

## Test Coverage

### Target Coverage
- Aim for **high coverage on business logic**: 80%+ on services, models, core algorithms.
- Accept **lower coverage on glue code**: HTTP handlers, configuration, simple getters/setters often aren't worth testing individually.
- **Don't chase 100%**: Coverage is a tool, not a goal. Unmeasurable code (e.g., one exception path) doesn't need a test.

### Measuring Coverage
- Use built-in coverage tools (pytest, Jest, Go's `coverage`, etc.).
- Establish a baseline; aim to maintain or improve it with each PR.
- Review uncovered lines; if a line is uncovered and unused, delete it.

---

## Test Data & Fixtures

### Factories & Builders
- Create reusable test data using factories or builders, not hardcoded values.
- Example: `UserFactory.build(email: "test@example.com")` instead of copying user objects in 20 tests.
- Factories are DRY and make it easy to add required fields when schemas evolve.

### Mocking Time & Randomness
- Never rely on system time in tests: `new Date()`, `now()`, `time.Time{}` will fail non-deterministically.
- Inject a clock dependency; mock it in tests. Use fixed values: `clock.now() = "2024-01-15 10:30:00"`.
- Never rely on random data in assertions. Generate test data deterministically or use fixed seeds.

### Database Fixtures
- Use migrations or seeding scripts to set up test data, not manual SQL.
- Clean up after each test: truncate tables, roll back transactions, or use a fresh database.
- Avoid brittle fixtures: don't assume specific IDs; query by unique fields (email, username, etc.).

---

## Refactoring

### Safe Refactoring
- Tests give you confidence to refactor. If tests pass, the behavior is preserved.
- Refactor frequently: extract functions, rename variables, simplify logic.
- After each refactor, run tests immediately. If a test breaks, the refactor revealed a gap in logic or assumptions.

### Refactoring Rules
1. Make sure all tests pass before refactoring.
2. Refactor a small piece at a time (not the whole codebase at once).
3. Run tests after each small step.
4. If tests break during refactoring, revert and try a different approach.
5. Once refactoring is complete and tests pass, commit.

---

## Common Pitfalls & How to Avoid Them

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **Over-mocking** | Tests verify interactions, not behavior; brittle to implementation changes | Mock external dependencies only; test behavior through public interfaces |
| **Skipped tests** | Hidden failures; tests decay and become useless | Delete or fix failing tests; never skip without a plan to fix |
| **Time-dependent tests** | Fail randomly; unreliable CI | Mock time; use fixed test data |
| **Shared test state** | Tests affect each other; order-dependent failures | Isolate each test; set up and tear down cleanly |
| **Vague test names** | Hard to understand what's being tested | Use `given_when_then` or similar; name should read as a spec |
| **Testing implementation** | Tests break when implementation changes, even if behavior is unchanged | Test behavior (what should happen), not how (which calls happen) |
| **No setup/teardown** | Test data leaks; database state isn't clean | Use fixtures, factories, or transactions to reset state between tests |
| **Assertion overload** | Hard to see what failed; test does too much | One logical assertion per test; use multiple test methods if needed |

---

## Integration with CI/CD

### Before Merge
- All tests (unit, integration, E2E) must pass.
- Coverage must not decrease (or meet a minimum threshold).
- No `@skip`, `@pending`, or commented-out tests.

### PR Workflow
1. Write a failing test.
2. Implement the feature.
3. Tests pass locally and in CI.
4. Refactor if needed; tests still pass.
5. Merge.

---

## Summary

TDD inverts development: **test first, code second**. Benefits:

- **Design through testing**: Tests guide architecture; hard-to-test designs get fixed early.
- **Comprehensive coverage**: Every feature has a test; refactoring is safe.
- **Documentation**: Tests document expected behavior.
- **Confidence**: Green tests mean the system works.

Remember:
1. **Red**: Write a failing test.
2. **Green**: Write minimum code to pass.
3. **Refactor**: Improve while keeping tests green.
4. One test at a time; never skip failing tests.
5. Mock I/O; test behavior; keep tests fast and isolated.

Discipline is key. Follow the Red-Green-Refactor cycle strictly, and you'll build systems that are correct, maintainable, and easy to change.
