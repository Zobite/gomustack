import type { FastifyInstance } from "fastify";
import { registerS3Routes } from "./s3.controller.js";

export default async function s3Module(app: FastifyInstance) {
  registerS3Routes(app);
}

export const MODULE_PREFIX = "/s3";
