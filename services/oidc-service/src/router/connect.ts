import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { configuration } from "../server/configuration";
import { connectOidcToIdentityController, connectOidcToIdentitySchema } from "../controller";
import { identityAuthMiddleware } from "../middleware";
import { redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.use(identityAuthMiddleware());

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
    path: "data.callbackUri",
  }),
  useSchema(connectOidcToIdentitySchema),
  useController(connectOidcToIdentityController),
);
