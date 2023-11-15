import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmEnrolmentController,
  confirmEnrolmentSchema,
  getEnrolmentStatusController,
  getEnrolmentStatusSchema,
  initialiseEnrolmentController,
  initialiseEnrolmentSchema,
  rejectEnrolmentController,
  rejectEnrolmentSchema,
} from "../controller";
import {
  enrolmentSessionEntityMiddleware,
  enrolmentSessionTokenMiddleware,
  identityAuthMiddleware,
  identityIdRateLimit,
} from "../middleware";
import { deviceHeadersSchema } from "../schema";

export const router = new Router<any, any>();

// use ip for rate limit middleware
// router.use(deviceIpRateLimit("ip"));

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
  useController(rejectEnrolmentController),
);

router.get(
  "/:id/status",
  paramsMiddleware,
  useSchema(getEnrolmentStatusSchema),
  useController(getEnrolmentStatusController),
);
