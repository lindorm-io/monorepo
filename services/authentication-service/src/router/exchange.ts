import { Router, useController, useSchema } from "@lindorm-io/koa";
import { tokenExchangeController, tokenExchangeSchema } from "../controller";
import { clientAuthMiddleware } from "../middleware";

export const router = new Router<any, any>();

router.use(clientAuthMiddleware());

router.post("/", useSchema(tokenExchangeSchema), useController(tokenExchangeController));
