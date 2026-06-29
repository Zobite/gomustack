# Contributing to GomuStack

Thank you for your interest in contributing to GomuStack! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime ≥ 1.2
- [Git](https://git-scm.com/)
- Node.js ≥ 18 (for some tooling)

### Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/gomustack.git
cd gomustack

# 2. Install dependencies
bun install

# 3. Start the dev server (API + Vite HMR)
bun run dev

# 4. Open the Web UI
open http://localhost:5610
```

The dev server runs both the Fastify API server and the Vite dev server concurrently with hot module replacement.

## Project Structure

```
gomustack/
├── src/
│   ├── server/                    # Fastify API server
│   │   └── src/
│   │       ├── modules/           # Feature modules (auto-loaded)
│   │       └── common/            # Shared infrastructure (DB, auth, utils)
│   └── web/                       # React frontend (Vite)
│       └── src/
│           └── modules/           # Feature modules (mirrors server)
├── bin/                           # CLI entry point
├── docs/                          # Feature documentation & specs
└── public/                        # Bundled web assets (production)
```

### Module Architecture

Each feature is an independent module with 4 files:

```
src/server/src/modules/<name>/
├── <name>.module.ts        # Fastify plugin + MODULE_PREFIX export
├── <name>.controller.ts    # Route handlers (thin layer)
├── <name>.service.ts       # Business logic + Drizzle queries
└── <name>.schema.ts        # Zod schemas
```

Modules are **auto-loaded** — no need to modify `app.ts`.

## Making Changes

### Branch Naming

Use descriptive branch names with a prefix:

- `feat/` — new features (e.g., `feat/table-views`)
- `fix/` — bug fixes (e.g., `fix/variable-ttl-expiry`)
- `docs/` — documentation changes (e.g., `docs/api-examples`)
- `refactor/` — code refactoring (e.g., `refactor/auth-middleware`)
- `test/` — test additions or fixes (e.g., `test/variables-crud`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`

**Examples:**

```
feat(tables): add board view for dynamic tables
fix(storage): handle presigned URL expiry edge case
docs(readme): update MCP configuration examples
test(variables): add TTL expiry integration tests
```

### Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run checks locally:
   ```bash
   # Type checking
   bun run typecheck:server
   bun run typecheck:web

   # Lint & format
   bun run biome:check

   # Tests
   cd src/server && bun test
   ```
4. Commit your changes
5. Push and open a Pull Request

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

**Key rules:**
- Indent: 2 spaces
- Quotes: double quotes
- Line width: 160 characters
- No unused imports (warning)
- Organize imports automatically

```bash
# Check and auto-fix
bun run biome:check

# Lint only
bun run lint

# Format only
bun run format
```

### TypeScript Guidelines

- Use Zod schemas for validation (not manual type guards)
- Use Drizzle ORM for database queries (not raw SQL)
- Keep controllers thin — business logic belongs in services
- Export `MODULE_PREFIX` from each module for auto-loading

## Testing

Tests are **integration tests** that run against the real API server.

### Running Tests

```bash
# Start the dev server first
bun run dev

# In another terminal, run tests
cd src/server
bun test                          # Run all tests
bun test tests/<module>.test.ts   # Run specific module
```

### Writing Tests

- Create test files at `src/server/tests/<module>.test.ts`
- Use `bun:test` (`describe`, `it`, `expect`, `beforeAll`, `afterAll`)
- Test the **full CRUD lifecycle**: create → read → update → delete → verify
- Test **error cases**: invalid input, non-existent IDs, unauthorized access
- **Clean up** test data in `afterAll()` to avoid polluting the database

## Submitting a Pull Request

1. Ensure all checks pass locally (`typecheck`, `lint`, `test`)
2. Push your branch and open a PR against `main`
3. Fill in the PR template with:
   - Description of changes
   - Type of change (bugfix/feature/docs)
   - Testing performed
4. Wait for CI checks to pass
5. Request a review

### PR Review Criteria

- Code follows project conventions
- Changes are covered by tests (for server changes)
- Both server and web layers are updated if applicable
- Documentation is updated for API changes

## Reporting Bugs

Use [GitHub Issues](https://github.com/Zobite/gomustack/issues) to report bugs. Please include:

- **Steps to reproduce** the bug
- **Expected behavior** vs **actual behavior**
- **Environment**: OS, Bun version, browser (if web UI related)
- **Screenshots** or error logs if applicable

## Requesting Features

Open a [GitHub Issue](https://github.com/Zobite/gomustack/issues) with the "Feature Request" template. Describe:

- **Problem** you're trying to solve
- **Proposed solution** or feature
- **Alternatives** you've considered

---

Thank you for contributing! 🎉
