import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmChallengeController,
  confirmChallengeSchema,
  initialiseChallengeController,
  initialiseChallengeSchema,
  rejectChallengeController,
  rejectChallengeSchema,
} from "../controller";
import {
  assertSignatureDeviceLinkMiddleware,
  challengeSessionEntityMiddleware,
  challengeSessionTokenMiddleware,
  deviceLinkEntityMiddleware,
  deviceLinkIdRateLimitBackoff,
  publicKeyEntityMiddleware,
  signatureMiddleware,
} from "../middleware";
import { deviceHeadersEnrolledSchema, signatureHeadersSchema } from "../schema";

export const router = new Router<any, any>();

router.use(
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  // use ip for rate limit middleware
  // deviceIpRateLimit("ip"),
);

router.post(
  "/",
  useSchema(initialiseChallengeSchema),
  useSchema(signatureHeadersSchema, "headers"),
  signatureMiddleware,
  assertSignatureDeviceLinkMiddleware,
  deviceLinkEntityMiddleware("data.deviceLinkId"),
  useController(initialiseChallengeController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmChallengeSchema),
  challengeSessionTokenMiddleware("data.challengeSessionToken"),
  challengeSessionEntityMiddleware("data.id"),
  deviceLinkEntityMiddleware("entity.challengeSession.deviceLinkId"),
  publicKeyEntityMiddleware("entity.deviceLink.publicKeyId"),
  deviceLinkIdRateLimitBackoff("entity.deviceLink.id"),
  useController(confirmChallengeController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectChallengeSchema),
  challengeSessionTokenMiddleware("data.challengeSessionToken"),
  challengeSessionEntityMiddleware("data.id"),
  useController(rejectChallengeController),
);
