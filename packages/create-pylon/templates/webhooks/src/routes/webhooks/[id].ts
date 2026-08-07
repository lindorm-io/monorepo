// TODO: guard these routes — they expose webhook subscription management.
// `useAccessToken()` from @lindorm/pylon resolves the presented credential on
// every transport; it reads the issuer from the `auth` block, so scaffold with
// OIDC authentication (or add one) before mounting it.
import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context.js";
import {
  deleteWebhookHandler,
  deleteWebhookSchema,
} from "../../features/webhooks/delete-webhook-handler.js";
import {
  getWebhookHandler,
  getWebhookSchema,
} from "../../features/webhooks/get-webhook-handler.js";
import {
  updateWebhookHandler,
  updateWebhookSchema,
} from "../../features/webhooks/update-webhook-handler.js";

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
