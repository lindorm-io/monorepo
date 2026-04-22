// TODO: add auth middleware — these routes expose webhook subscription management.
import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context.js";
import {
  createWebhookHandler,
  createWebhookSchema,
} from "../../features/webhooks/create-webhook-handler.js";
import {
  listWebhooksHandler,
  listWebhooksSchema,
} from "../../features/webhooks/list-webhooks-handler.js";

export const POST: Array<ServerHttpMiddleware> = [
  useSchema(createWebhookSchema),
  useHandler(createWebhookHandler),
];

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(listWebhooksSchema),
  useHandler(listWebhooksHandler),
];
