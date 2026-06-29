<p align="center">
  <h1 align="center">🚀 GomuStack</h1>
  <p align="center">
    <strong>LLM-first knowledge base — Docs, DataTables, MCP server, S3-compatible file store.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/Zobite/gomustack/releases"><img src="https://img.shields.io/badge/version-1.0.3-blue" alt="Version"></a>
    <a href="https://github.com/Zobite/gomustack/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
    <a href="https://hub.docker.com/r/zobite/gomustack"><img src="https://img.shields.io/docker/pulls/zobite/gomustack" alt="Docker Pulls"></a>
    <img src="https://img.shields.io/badge/runtime-Bun-f9e1b3?logo=bun" alt="Bun">
    <img src="https://img.shields.io/badge/database-SQLite-003B57?logo=sqlite" alt="SQLite">
  </p>
</p>

---

## What is GomuStack?

GomuStack is a self-hosted backend gateway designed to give AI coding agents (Claude Code, Cursor, Windsurf, etc.) persistent memory and real-world capabilities. It exposes everything through an **MCP server** and a **REST API**, so your AI agents can store data, browse the web, execute code, and manage files — all from a single service.

<p align="center">
  <img src="docs/images/architecture.png" alt="GomuStack Architecture" width="700">
</p>

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker run -d \
  --name gomustack \
  -p 5610:5610 \
  -v gomustack-data:/data \
  zobite/gomustack:latest
```

Open `http://localhost:5610` in your browser.

#### Docker Compose

```yaml
services:
  gomustack:
    image: zobite/gomustack:latest
    container_name: gomustack
    ports:
      - "5610:5610"
    environment:
      - HOST=0.0.0.0
      - PORT=5610
      - DATA_DIR=/data
    volumes:
      - gomustack-data:/data
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  gomustack-data:
```

```bash
docker compose up -d        # Start
docker compose logs -f      # View logs
docker compose down         # Stop
```

---

### Option 2: From Source

> **Prerequisites:** [Bun](https://bun.sh) (latest)

```bash
# Clone the repo
git clone https://github.com/Zobite/gomustack.git
cd gomustack

# Install dependencies
bun install

# Start dev server (server + web concurrently)
bun run dev

# Or start server/web separately
bun run dev:server
bun run dev:web
```

The dev server runs at `http://localhost:5610`.

#### Build for Production

```bash
# Build both web & server
bun run build

# Run production server
bun run start
```

---

### First-time Setup

> 📝 Lần đầu truy cập `http://localhost:5610`, bạn sẽ được yêu cầu **tạo tài khoản admin**. Hãy đặt username và password theo ý bạn.

### Environment Variables

| Variable   | Default   | Description      |
| ---------- | --------- | ---------------- |
| `PORT`     | `5610`    | HTTP server port |
| `HOST`     | `0.0.0.0` | Bind address     |
| `DATA_DIR` | `/data`   | Data directory   |

---

## Features

### KV Store

Flat key-value store with typed values, optional TTL, and upsert semantics. Keys are globally unique — use prefixes for namespace organization.

<p align="center">
  <img src="docs/images/feature-kv-store.png" alt="KV Store" width="500">
</p>

**MCP Tools:** `kv_list`, `kv_get`, `kv_set`, `kv_delete`

### DataTables

Notion-like structured data tables organized by projects. Supports dynamic columns, row CRUD, bulk operations, and MQL (GomuStack Query Language) for advanced querying.

<p align="center">
  <img src="docs/images/feature-datatables.png" alt="DataTables" width="500">
</p>

**MCP Tools:** `datatables_list_projects`, `datatables_create_project`, `datatables_list_tables`, `datatables_create_table`, `datatables_update_table`, `datatables_add_column`, `datatables_update_column`, `datatables_delete_column`, `datatables_query_rows`, `datatables_get_row`, `datatables_insert_row`, `datatables_bulk_update_rows`, `datatables_bulk_delete_rows`

### Object Storage

Self-hosted S3-compatible object storage with buckets, file upload/download, presigned URLs, and public file serving. Works with any S3 SDK via endpoint `/s3`.

<p align="center">
  <img src="docs/images/feature-storage.png" alt="Object Storage" width="500">
</p>

**MCP Tools:** `storage_list_buckets`, `storage_list_objects`, `storage_get_object_info`, `storage_get_download_url`, `storage_upload_object`, `storage_delete_object`

### Browser Profiles

Multi-session stealth browser powered by Playwright + CloakBrowser. Isolated browser instances with custom fingerprints, proxies, and persistent sessions. Supports batch step execution: navigate, click, type, screenshot, extract content.

<p align="center">
  <img src="docs/images/feature-browsers.png" alt="Browser Profiles" width="500">
</p>

**MCP Tools:** `browser_list`, `browser_create`, `browser_start`, `browser_stop`, `browser_delete`, `browser_list_tabs`, `browser_run_steps`, `browser_quick_run`

### Dynamic APIs

Cloudflare Worker-like serverless runtime. Write JS/TS handler functions and GomuStack executes them on the fly. Supports **fast mode** (in-process) and **isolated mode** (subprocess sandbox with npm imports). Includes AI Coding Agent for code generation.

<p align="center">
  <img src="docs/images/feature-dynamic-apis.png" alt="Dynamic APIs" width="500">
</p>

**MCP Tools:** `dynamic_api_list`, `dynamic_api_get`, `dynamic_api_create`, `dynamic_api_update`, `dynamic_api_delete`

### MCP Tool Servers

Manage multiple MCP servers and custom tools. Built-in "System Tools" server exposes all core features as MCP tools. Create custom servers with JavaScript tool implementations, draft code workflow, execution logging, and AI Coding Agent support.

**MCP Tools:** `mcp_server_list`, `mcp_server_get`, `mcp_server_create`, `mcp_server_update`, `mcp_server_delete`, `mcp_tool_list`, `mcp_tool_get`, `mcp_tool_create`, `mcp_tool_update`, `mcp_tool_delete`, `mcp_tool_test`

### LLM Providers

Manage LLM provider configurations. Supports OpenRouter, OpenAI, Google Gemini, Anthropic, Ollama, and custom OpenAI-compatible endpoints. Auto-fetches available models from each provider.

---

## Tech Stack

| Component       | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| **Runtime**     | [Bun](https://bun.sh)                                        |
| **Server**      | [Fastify](https://fastify.io) v5                              |
| **Database**    | SQLite via [Drizzle ORM](https://orm.drizzle.team)            |
| **MCP SDK**     | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| **Browser**     | [Playwright](https://playwright.dev) + [CloakBrowser](https://www.npmjs.com/package/cloakbrowser) |
| **AI SDKs**     | [Vercel AI SDK](https://sdk.vercel.ai), [LangChain](https://js.langchain.com) |
| **Frontend**    | [React](https://react.dev) 19 + [Vite](https://vitejs.dev) 8 |
| **UI Library**  | [Ant Design](https://ant.design) 6 + [Tailwind CSS](https://tailwindcss.com) 4 |
| **Data Grid**   | [AG Grid](https://www.ag-grid.com)                            |
| **Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/)  |
| **State**       | [Zustand](https://zustand-demo.pmnd.rs)                      |

---

## Development

```bash
# Clone
git clone https://github.com/Zobite/gomustack.git
cd gomustack

# Install dependencies
bun install

# Start dev server (server + web concurrently)
bun run dev

# Server only
bun run dev:server

# Web only
bun run dev:web

# Type checking
bun run typecheck:server
bun run typecheck:web

# Lint & format (web)
bun run lint
bun run lint:fix
bun run format

# Build for production
bun run build
```

## Data Storage

All data is stored in `/data` (Docker) or `~/.gomustack` (local dev) by default (configurable via `DATA_DIR`):

```
/data/  (or ~/.gomustack/)
├── gomustack.db            # SQLite database (all metadata)
├── storage/                # Object storage files (organized by bucket)
├── browsers/               # Browser profile data directories
├── screenshots/            # Captured browser screenshots
├── server.pid              # Daemon PID file
└── server.log              # Server log output
```

---

## License

[MIT](LICENSE) © [Zobite](https://github.com/Zobite)
