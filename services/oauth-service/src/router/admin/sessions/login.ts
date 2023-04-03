import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";
import {
  confirmLoginController,
  confirmLoginSchema,
  rejectLoginController,
  rejectLoginSchema,
} from "../../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmLoginController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectLoginController),
);
