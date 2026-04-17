import { merge } from "@lindorm/utils";
import { PylonRouter } from "../../classes";
import { PylonAuthConfig, PylonHttpContext } from "../../types";
import { createAuthHandler } from "./auth/auth-handler";
import { backchannelLogoutHandler } from "./auth/backchannel-logout-handler";
import { errorHandler } from "./auth/error-handler";
import { createIntrospectHandler } from "./auth/introspect-handler";
import { createLoginCallbackHandler } from "./auth/login-callback-handler";
import { createLoginHandler, loginSchema } from "./auth/login-handler";
import { createLogoutCallbackHandler } from "./auth/logout-callback-handler";
import { createLogoutHandler, logoutSchema } from "./auth/logout-handler";
import { createRefreshMiddleware } from "./auth/refresh-middleware";
import { createUserinfoHandler } from "./auth/userinfo-handler";
import { noopHandler } from "./noop-handler";
import { useSchema } from "../../middleware";

export const createAuthRouter = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();
  const routerConfig = config.router!;

  const refreshMiddleware = createRefreshMiddleware(config);
  const forceRefresh = createRefreshMiddleware(
    merge(config, { refresh: { mode: "force" } }),
  );

  router.get("/", refreshMiddleware, createAuthHandler(routerConfig));

  router.post("/backchannel-logout", backchannelLogoutHandler);

  router.get("/error", errorHandler);

  if (routerConfig.introspect) {
    router.get("/introspect", refreshMiddleware, createIntrospectHandler());
  }

  router.get("/login", useSchema(loginSchema), createLoginHandler(routerConfig));

  router.get("/login/callback", createLoginCallbackHandler(config));

  router.get("/logout", useSchema(logoutSchema), createLogoutHandler(routerConfig));

  router.get("/logout/callback", createLogoutCallbackHandler(routerConfig));

  router.get("/refresh", forceRefresh, noopHandler);

  router.get("/userinfo", refreshMiddleware, createUserinfoHandler());

  return router;
};
