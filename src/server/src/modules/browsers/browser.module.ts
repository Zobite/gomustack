import type { FastifyInstance } from "fastify";
import { registerBrowserRoutes } from "./browser.controller.js";
import { preloadCloakBrowser } from "./browser.service.js";

export default async function browsersModule(app: FastifyInstance) {
  registerBrowserRoutes(app);
  preloadCloakBrowser();
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/browsers";
