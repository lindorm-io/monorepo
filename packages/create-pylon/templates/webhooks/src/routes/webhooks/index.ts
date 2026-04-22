// TODO: add auth middleware — these routes expose webhook subscription management.
import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context.js";
import {
  createWebhookHandler,
  createWebhookSchema,
} from "../../handlers/create-webhook-handler.js";
import {
  listWebhooksHandler,
  listWebhooksSchema,
} from "../../handlers/list-webhooks-handler.js";

export const POST: Array<ServerHttpMiddleware> = [
  useSchema(createWebhookSchema),
  useHandler(createWebhookHandler),
];

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(listWebhooksSchema),
  useHandler(listWebhooksHandler),
];
