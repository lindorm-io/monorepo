import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, clientEntityMiddleware } from "../middleware";
import { tokenIntrospectController, tokenIntrospectSchema } from "../controller";

export const router = new Router<any, any>();

router.use(clientAuthMiddleware());

router.post(
  "/",
  useSchema(tokenIntrospectSchema),
  clientEntityMiddleware("token.bearerToken.subject"),
  useController(tokenIntrospectController),
);
