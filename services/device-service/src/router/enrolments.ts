import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import { deviceHeadersSchema } from "../schema";
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
  deviceIpRateLimit,
  enrolmentSessionEntityMiddleware,
  enrolmentSessionTokenMiddleware,
  identityAuthMiddleware,
  identityIdRateLimit,
} from "../middleware";

const router = new Router<any, any>();
export default router;

router.use(deviceIpRateLimit("metadata.device.ip"));

router.post(
  "/",
  identityAuthMiddleware(),
  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(initialiseEnrolmentSchema),
  useSchema(deviceHeadersSchema, "headers"),
  useController(initialiseEnrolmentController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  identityAuthMiddleware(),
  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(confirmEnrolmentSchema),
  useSchema(deviceHeadersSchema, "headers"),
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
  identityAuthMiddleware(),
  identityIdRateLimit("token.bearerToken.subject"),
  useSchema(rejectEnrolmentSchema),
  useSchema(deviceHeadersSchema, "headers"),
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
