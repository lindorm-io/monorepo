import { rateLimitBackoffMiddleware, rateLimitMiddleware } from "@lindorm-io/koa-redis";

export const deviceFingerprintRateLimit = rateLimitMiddleware({
  expiresInSeconds: 60,
  keyName: "device-fingerprint",
  limit: 100,
});

export const deviceIpRateLimit = rateLimitMiddleware({
  expiresInSeconds: 60,
  keyName: "device-ip",
  limit: 100,
});

export const deviceLinkIdRateLimitBackoff = rateLimitBackoffMiddleware({
  keyName: "device-link-id",
});

export const identityIdRateLimit = rateLimitMiddleware({
  expiresInSeconds: 60,
  keyName: "identity-id",
  limit: 100,
});
