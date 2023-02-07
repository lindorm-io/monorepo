import { includes } from "lodash";
import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import { SessionStatuses } from "@lindorm-io/common-types";
import {
  challengeConfirmationTokenMiddleware,
  rdcSessionEntityMiddleware,
  rdcSessionTokenMiddleware,
  identityAuthMiddleware,
} from "../middleware";
import {
  acknowledgeRdcController,
  acknowledgeRdcSchema,
  confirmRdcController,
  confirmRdcSchema,
  rejectRdcController,
  rejectRdcSchema,
  getRdcSessionStatusController,
  getRdcSessionStatusSchema,
} from "../controller";

const router = new Router();
export default router;

router.post(
  "/:id/acknowledge",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(acknowledgeRdcSchema),
  rdcSessionEntityMiddleware("data.id"),
  useAssertion({
    assertion: includes,
    expect: [SessionStatuses.PENDING],
    fromPath: {
      actual: "entity.rdcSession.status",
    },
    hint: "status",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.rdcSession.identityId",
      actual: "token.bearerToken.subject",
    },
    hint: "identityId",
  }),
  useController(acknowledgeRdcController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(confirmRdcSchema),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  rdcSessionTokenMiddleware("data.rdcSessionToken"),
  rdcSessionEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.rdcSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useAssertion({
    fromPath: {
      expect: "token.challengeConfirmationToken.subject",
      actual: "token.bearerToken.subject",
    },
    hint: "subject",
  }),
  useAssertion({
    fromPath: {
      expect: "token.rdcSessionToken.nonce",
      actual: "token.challengeConfirmationToken.nonce",
    },
    hint: "nonce",
  }),
  useController(confirmRdcController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(rejectRdcSchema),
  rdcSessionTokenMiddleware("data.rdcSessionToken"),
  rdcSessionEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.rdcSessionToken.sessionId",
    },
    hint: "sessionId",
  }),
  useController(rejectRdcController),
);

router.get(
  "/:id/status",
  paramsMiddleware,
  useSchema(getRdcSessionStatusSchema),
  useController(getRdcSessionStatusController),
);
