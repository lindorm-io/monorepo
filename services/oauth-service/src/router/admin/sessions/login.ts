import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmLoginController,
  confirmLoginSchema,
  rejectLoginController,
  rejectLoginSchema,
} from "../../../controller";
import { AuthorizationRequestEntityMiddleware, clientEntityMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLoginSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationRequest.clientId"),
  useController(confirmLoginController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLoginSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  useController(rejectLoginController),
);
