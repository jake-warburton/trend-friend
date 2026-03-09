# Stack & Infrastructure Context

This directory contains technical architecture, stack specifics, and infrastructure decisions that override or extend the generic baseline instruction file.

## Purpose

Files in this directory communicate the technical environment and constraints:

- **Tech stack**: Programming languages, frameworks, runtimes, and versions
- **Cloud infrastructure**: Hosting, services, regions, deployment models
- **External integrations**: APIs, databases, message queues, caching layers, SaaS tools
- **Service architecture**: Microservices topology, inter-service contracts, protocols
- **CI/CD & deployment**: Build pipelines, environments, release procedures
- **Database schema**: Entity relationships, migration strategy, indexing strategy
- **System diagrams**: Architecture diagrams (as text, Mermaid, or ASCII)

## What to Put Here

Create one file per system or integration. Examples:

### `aws.md`
- AWS services in use (EC2, RDS, S3, Lambda, etc.)
- Region strategy and failover architecture
- VPC setup, security groups, IAM policies (high level; detailed secrets in `.env`)
- Example: "All services run in us-east-1 and us-west-2 with Route53 failover"

### `postgres.md`
- Database setup: version, connection pooling strategy
- Schema structure and key tables
- Indexing strategy and performance considerations
- Migration tool and naming conventions
- Example: "Migrations use Flyway in `migrations/` folder; all new columns are nullable initially"

### `redis.md`
- Cache topology: single instance, cluster, or sentinel
- Key naming conventions and TTL strategy
- Data types used and size estimates
- Invalidation strategy
- Example: "Session keys use pattern `session:{user_id}` with 24-hour TTL"

### `stripe-integration.md` (or other third-party APIs)
- API version and endpoint base URLs
- Authentication method (API keys, OAuth, webhooks)
- Webhook events handled and processing strategy
- Error handling and retry logic
- Example: "Stripe webhooks are processed asynchronously via a background job queue"

### `ci-cd.md`
- Build system and container orchestration (GitHub Actions, Jenkins, GitLab CI, etc.)
- Test suite structure and execution order
- Deployment environments and promotion process
- Rollback procedures
- Example: "PRs require all tests to pass; merges to main trigger production deploy automatically"

### `service-architecture.md`
- High-level service topology
- Inter-service communication protocols (REST, gRPC, async messaging)
- Service dependencies and criticality
- Example using Mermaid:
```
graph LR
  API[API Gateway] --> Users[User Service]
  API --> Orders[Order Service]
  Orders --> Payments[Payment Service]
  Orders --> Inventory[Inventory Service]
  Payments -.webhook.-> Stripe
```

### `database-schema.md`
- ER diagram or description of major tables
- Key relationships and constraints
- Sharding or partitioning strategy (if applicable)
- Example: "Users table partitioned by region for performance"

## Convention

- Use **kebab-case** filenames (`postgres.md`, not `PostgreSQL.md`)
- Keep files **focused**: one system or integration per file
- Include concrete examples (connection strings pattern, API endpoints, table names)
- Link files when there are dependencies
- Never commit actual credentials; use `.env.example` instead
- Update when stack changes (version upgrades, new integrations, etc.)

## Optional: Defining the Agent's Technical Role in Your Project

Create an optional file `llm-role.md` to describe how your coding agent should approach technical decisions in your project. This helps the agent understand your priorities and constraints.

Example:
```markdown
# Agent Technical Role in This Project

## Primary Focus
- Act as a senior backend architect with expertise in distributed systems and database optimization
- Prioritize reliability and observability; this is a critical payment processing system
- For performance-critical code, balance clarity with optimization (profiling data available)

## Project Constraints
- We use gRPC for all inter-service communication; never suggest REST between services
- All state must be explicitly logged to our audit trail for compliance
- Database schema changes require migration planning; schema is shared across 50+ microservices
- We have strict latency budgets (p99 < 100ms) for public APIs

## Decision-Making
- When uncertain about system behavior, check `service-architecture.md` for service topology
- For database decisions, consult `postgres.md`; our query patterns are heavily read-heavy
- When suggesting external services, consider our cloud-native-first policy
```

This file helps the agent make technical decisions aligned with your system's constraints and architectural decisions.


## How an Agent Uses These Files

Your coding agent should read files in `context/stack/` at the start of each session to understand:

- Which services are available and their capabilities
- How to structure code to match the existing tech choices
- Integration points and contracts to respect
- Infrastructure constraints (e.g., "No local disk storage; use S3")

**Example**: The base instruction file suggests "use async/await for concurrency." But if `service-architecture.md` documents "All inter-service calls are synchronous RPC," the agent should respect that constraint.

## Link from the Main Instruction File

In your project's main instruction file, add a reference to this directory:

```markdown
## Source of Truth

Check `context/business/` and `context/stack/` first; they override generic guidelines.
See those directories for project-specific context.
```

Your agent will then load these files automatically if it supports that workflow.
