import { includes } from "lodash";
import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
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

const router = new Router<any, any>();
export default router;

router.use(
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  deviceIpRateLimit("metadata.device.ip"),
);

router.post(
  "/",
  useSchema(initialiseChallengeSchema),
  useAssertion({
    fromPath: {
      expect: "data.deviceLinkId",
      actual: "metadata.device.linkId",
    },
    hint: "deviceLinkId",
  }),
  deviceLinkEntityMiddleware("data.deviceLinkId"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "data.identityId",
    },
    hint: "identityId",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.installationId",
      actual: "metadata.device.installationId",
    },
    hint: "installationId",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.uniqueId",
      actual: "metadata.device.uniqueId",
    },
    hint: "uniqueId",
  }),
  useAssertion({
    expect: true,
    fromPath: { actual: "entity.deviceLink.active" },
    hint: "active",
  }),
  useAssertion({
    expect: true,
    fromPath: { actual: "entity.deviceLink.trusted" },
    hint: "trusted",
  }),
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
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.challengeSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useAssertion({
    assertion: includes,
    fromPath: {
      expect: "entity.challengeSession.strategies",
      actual: "data.strategy",
    },
    hint: "strategy",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.id",
      actual: "metadata.device.linkId",
    },
    hint: "deviceLinkId",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.installationId",
      actual: "metadata.device.installationId",
    },
    hint: "installationId",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.uniqueId",
      actual: "metadata.device.uniqueId",
    },
    hint: "uniqueId",
  }),
  useController(confirmChallengeController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectChallengeSchema),
  challengeSessionTokenMiddleware("data.challengeSessionToken"),
  challengeSessionEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.challengeSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useController(rejectChallengeController),
);
