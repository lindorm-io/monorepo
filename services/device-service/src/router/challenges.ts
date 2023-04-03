import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { deviceHeadersEnrolledSchema } from "../schema";
import {
  confirmChallengeController,
  confirmChallengeSchema,
  initialiseChallengeController,
  initialiseChallengeSchema,
  rejectChallengeController,
  rejectChallengeSchema,
} from "../controller";
import {
  challengeSessionEntityMiddleware,
  challengeSessionTokenMiddleware,
  deviceIpRateLimit,
  deviceLinkEntityMiddleware,
  deviceLinkIdRateLimitBackoff,
} from "../middleware";

export const router = new Router<any, any>();

router.use(
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  deviceIpRateLimit("metadata.device.ip"),
);

router.post(
  "/",
  useSchema(initialiseChallengeSchema),
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
