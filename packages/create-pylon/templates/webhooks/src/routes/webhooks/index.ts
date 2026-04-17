// TODO: add auth middleware — these routes expose webhook subscription management.
import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context";
import {
  createWebhookHandler,
  createWebhookSchema,
} from "../../handlers/create-webhook-handler";
import {
  listWebhooksHandler,
  listWebhooksSchema,
} from "../../handlers/list-webhooks-handler";

export const POST: Array<ServerHttpMiddleware> = [
  useSchema(createWebhookSchema),
  useHandler(createWebhookHandler),
];

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(listWebhooksSchema),
  useHandler(listWebhooksHandler),
];
