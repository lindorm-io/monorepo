import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { oidcSessionCallbackController, oidcSessionCallbackSchema } from "../controller/oidc";
import { oidcSessionEntityMiddleware } from "../middleware";
import { configuration } from "../server/configuration";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
  }),
  useSchema(oidcSessionCallbackSchema),
  oidcSessionEntityMiddleware("data.state", { attributeKey: "state" }),
  useController(oidcSessionCallbackController),
);
