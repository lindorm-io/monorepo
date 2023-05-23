import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmSelectAccountController,
  confirmSelectAccountSchema,
  rejectSelectAccountController,
  rejectSelectAccountSchema,
} from "../../../controller";
import { AuthorizationRequestEntityMiddleware, clientEntityMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmSelectAccountSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationRequest.clientId"),
  useController(confirmSelectAccountController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectSelectAccountSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  useController(rejectSelectAccountController),
);
