// TODO: add auth middleware — these routes expose webhook subscription management.
import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context";
import {
  deleteWebhookHandler,
  deleteWebhookSchema,
} from "../../handlers/delete-webhook-handler.js";
import {
  getWebhookHandler,
  getWebhookSchema,
} from "../../handlers/get-webhook-handler.js";
import {
  updateWebhookHandler,
  updateWebhookSchema,
} from "../../handlers/update-webhook-handler.js";

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(getWebhookSchema),
  useHandler(getWebhookHandler),
];

export const PATCH: Array<ServerHttpMiddleware> = [
  useSchema(updateWebhookSchema),
  useHandler(updateWebhookHandler),
];

export const DELETE: Array<ServerHttpMiddleware> = [
  useSchema(deleteWebhookSchema),
  useHandler(deleteWebhookHandler),
];
