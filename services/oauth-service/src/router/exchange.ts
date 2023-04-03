import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, clientEntityMiddleware } from "../middleware";
import { tokenExchangeController, tokenExchangeSchema } from "../controller";

export const router = new Router<any, any>();

router.use(clientAuthMiddleware());

router.post(
  "/",
  useSchema(tokenExchangeSchema),
  clientEntityMiddleware("token.bearerToken.subject"),
  useController(tokenExchangeController),
);
