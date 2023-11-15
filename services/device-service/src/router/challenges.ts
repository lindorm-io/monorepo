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
  challengeSessionEntityMiddleware,
  challengeSessionTokenMiddleware,
  deviceLinkEntityMiddleware,
  deviceLinkIdRateLimitBackoff,
} from "../middleware";
import { deviceHeadersEnrolledSchema } from "../schema";

export const router = new Router<any, any>();

router.use(
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  // use ip for rate limit middleware
  // deviceIpRateLimit("ip"),
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
