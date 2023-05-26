import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmConsentController,
  confirmConsentSchema,
  rejectConsentController,
  rejectConsentSchema,
} from "../../../controller";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmConsentController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectConsentController),
);
