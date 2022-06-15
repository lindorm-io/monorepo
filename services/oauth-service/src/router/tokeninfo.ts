import { ServerKoaContext } from "../types";
import { Router, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, clientEntityMiddleware } from "../middleware";
import { tokeninfoController, tokeninfoSchema } from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(tokeninfoSchema),
  clientAuthMiddleware(),
  clientEntityMiddleware("token.bearerToken.subject"),
  useAssertion({
    expect: true,
    fromPath: {
      actual: "entity.client.active",
    },
  }),
  useController(tokeninfoController),
);
