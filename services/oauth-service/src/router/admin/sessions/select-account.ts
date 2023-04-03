import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";
import {
  confirmSelectAccountController,
  confirmSelectAccountSchema,
  rejectSelectAccountController,
  rejectSelectAccountSchema,
} from "../../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmSelectAccountController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectSelectAccountController),
);
