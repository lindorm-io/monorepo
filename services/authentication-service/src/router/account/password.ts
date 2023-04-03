import { Router, useController, useSchema } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import {
  createPasswordController,
  createPasswordSchema,
  updateAccountPasswordController,
  updateAccountPasswordSchema,
} from "../../controller";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(createPasswordSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 2,
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(createPasswordController),
);

router.patch(
  "/",
  useSchema(updateAccountPasswordSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 2,
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(updateAccountPasswordController),
);
