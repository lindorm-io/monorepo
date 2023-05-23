import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmConsentController,
  confirmConsentSchema,
  rejectConsentController,
  rejectConsentSchema,
} from "../../../controller";
import { AuthorizationRequestEntityMiddleware, clientEntityMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmConsentSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationRequest.clientId"),
  useController(confirmConsentController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectConsentSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  useController(rejectConsentController),
);
