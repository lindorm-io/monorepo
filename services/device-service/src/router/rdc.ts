import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { deviceHeadersEnrolledSchema } from "../schema";
import {
  challengeConfirmationTokenMiddleware,
  identityAuthMiddleware,
  rdcSessionEntityMiddleware,
  rdcSessionTokenMiddleware,
} from "../middleware";
import {
  acknowledgeRdcController,
  acknowledgeRdcSchema,
  confirmRdcController,
  confirmRdcSchema,
  getRdcSessionStatusController,
  getRdcSessionStatusSchema,
  rejectRdcController,
  rejectRdcSchema,
} from "../controller";

const router = new Router<any, any>();
export default router;

router.post(
  "/:id/acknowledge",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(acknowledgeRdcSchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  rdcSessionEntityMiddleware("data.id"),
  useController(acknowledgeRdcController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(confirmRdcSchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  rdcSessionTokenMiddleware("data.rdcSessionToken"),
  rdcSessionEntityMiddleware("data.id"),
  useController(confirmRdcController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(rejectRdcSchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  rdcSessionTokenMiddleware("data.rdcSessionToken"),
  rdcSessionEntityMiddleware("data.id"),
  useController(rejectRdcController),
);

router.get(
  "/:id/status",
  paramsMiddleware,
  useSchema(getRdcSessionStatusSchema),
  useController(getRdcSessionStatusController),
);
