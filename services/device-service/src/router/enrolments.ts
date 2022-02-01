import { Context } from "../types";
import { IdentityPermission } from "../common";
import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmEnrolmentController,
  confirmEnrolmentSchema,
  initialiseEnrolmentController,
  initialiseEnrolmentSchema,
  rejectEnrolmentController,
  rejectEnrolmentSchema,
  getEnrolmentStatusController,
  getEnrolmentStatusSchema,
} from "../controller";
import {
  deviceFingerprintRateLimit,
  deviceIpRateLimit,
  enrolmentSessionEntityMiddleware,
  enrolmentSessionTokenMiddleware,
  identityAuthMiddleware,
  identityIdRateLimit,
} from "../middleware";

const router = new Router<unknown, Context>();
export default router;

router.use(deviceFingerprintRateLimit("metadata.identifiers.fingerprint"));
router.use(deviceIpRateLimit("metadata.device.ip"));

router.post(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(initialiseEnrolmentSchema),
  useController(initialiseEnrolmentController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(confirmEnrolmentSchema),
  enrolmentSessionTokenMiddleware("data.enrolmentSessionToken"),
  enrolmentSessionEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.enrolmentSession.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.enrolmentSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useController(confirmEnrolmentController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(rejectEnrolmentSchema),
  enrolmentSessionTokenMiddleware("data.enrolmentSessionToken"),
  enrolmentSessionEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.enrolmentSession.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.enrolmentSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useController(rejectEnrolmentController),
);

router.get(
  "/:id/status",
  paramsMiddleware,
  useSchema(getEnrolmentStatusSchema),
  useController(getEnrolmentStatusController),
);
