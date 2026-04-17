import { createRepositoryMiddleware, WebhookSubscription } from "@lindorm/pylon";

export const MIDDLEWARE = [createRepositoryMiddleware([WebhookSubscription])];
