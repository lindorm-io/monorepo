// TODO: guard these routes — they expose webhook subscription management.
// `useAccessToken()` from @lindorm/pylon resolves the presented credential on
// every transport; it reads the issuer from the `auth` block, so scaffold with
// OIDC authentication (or add one) before mounting it.
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
