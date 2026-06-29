/**
 * Migration registry — import all migration files and export them in order.
 *
 * To add a new migration:
 *   1. Create `NNNN_descriptive_name.ts` in this directory
 *   2. Import and add it to the `migrations` array below
 */
import m0001 from "./0001_users.js";
import m0002 from "./0002_variables.js";
import m0003 from "./0003_datatables.js";
import m0004 from "./0004_documents.js";
import m0005 from "./0005_storage.js";
import m0006 from "./0006_mcp.js";
import m0007 from "./0007_dynamic_apis.js";
import m0008 from "./0008_llm_providers.js";
import m0009 from "./0009_configurations.js";
import m0010 from "./0010_browser_profiles.js";

import type { Migration } from "../migrate.js";

export const migrations: Migration[] = [
  m0001,
  m0002,
  m0003,
  m0004,
  m0005,
  m0006,
  m0007,
  m0008,
  m0009,
  m0010,
];
