import { merge } from "@lindorm/utils";
import { PylonRouter } from "../../classes/index.js";
import type { PylonAuthConfig, PylonHttpContext } from "../../types/index.js";
import { backchannelLogoutHandler } from "./auth/backchannel-logout-handler.js";
import { errorHandler } from "./auth/error-handler.js";
import { createIntrospectHandler } from "./auth/introspect-handler.js";
import { createLoginCallbackHandler } from "./auth/login-callback-handler.js";
import { createLoginHandler, loginSchema } from "./auth/login-handler.js";
import { createLogoutCallbackHandler } from "./auth/logout-callback-handler.js";
import { createLogoutHandler, logoutSchema } from "./auth/logout-handler.js";
import { createRefreshMiddleware } from "./auth/refresh-middleware.js";
import { createUserinfoHandler } from "./auth/userinfo-handler.js";
import { noopHandler } from "./noop-handler.js";
import { useSchema } from "../../middleware/index.js";

export const createAuthRouter = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();
  const routerConfig = config.router!;

  const refreshMiddleware = createRefreshMiddleware(config);
  const forceRefresh = createRefreshMiddleware(
    merge(config, { refresh: { mode: "force" } }),
  );

  router.post("/backchannel-logout", backchannelLogoutHandler);

  router.get("/error", errorHandler);

  router.get("/introspect", refreshMiddleware, createIntrospectHandler());

  router.get("/login", useSchema(loginSchema), createLoginHandler(routerConfig));

  router.get("/login/callback", createLoginCallbackHandler(config));

  router.get("/logout", useSchema(logoutSchema), createLogoutHandler(routerConfig));

  router.get("/logout/callback", createLogoutCallbackHandler(routerConfig));

  router.get("/refresh", forceRefresh, noopHandler);

  router.get("/userinfo", refreshMiddleware, createUserinfoHandler());

  return router;
};
