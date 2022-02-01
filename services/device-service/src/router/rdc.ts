import { Context } from "../types";
import { IdentityPermission, SessionStatus } from "../common";
import { includes } from "lodash";
import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
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

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/:id/acknowledge",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

  useSchema(acknowledgeRdcSchema),
  rdcSessionEntityMiddleware("data.id"),
  useAssertion({
    assertion: includes,
    expect: [SessionStatus.PENDING],
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
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

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
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),

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
