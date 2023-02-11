import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { oidcSessionCallbackController, oidcSessionCallbackSchema } from "../controller";
import { oidcSessionEntityMiddleware } from "../middleware";
import { configuration } from "../server/configuration";

const router = new Router<any, any>();
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
