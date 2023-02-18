import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, clientEntityMiddleware } from "../middleware";
import { tokeninfoController, tokeninfoSchema } from "../controller";

const router = new Router<any, any>();
export default router;

router.use(clientAuthMiddleware());

router.post(
  "/",
  useSchema(tokeninfoSchema),
  clientEntityMiddleware("token.bearerToken.subject"),
  useController(tokeninfoController),
);
