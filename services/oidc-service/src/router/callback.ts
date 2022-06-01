import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { useController, useSchema } from "@lindorm-io/koa";
import { oidcSessionCallbackController, oidcSessionCallbackSchema } from "../controller/oidc";
import { oidcSessionEntityMiddleware } from "../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  oidcSessionEntityMiddleware("data.state", { attributeKey: "state" }),
  useSchema(oidcSessionCallbackSchema),
  useController(oidcSessionCallbackController),
);
