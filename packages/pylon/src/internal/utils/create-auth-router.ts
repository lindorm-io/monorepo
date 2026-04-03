import { merge } from "@lindorm/utils";
import { PylonRouter } from "../../classes";
import { useSchema } from "../../middleware";
import { PylonAuthConfig, PylonHttpContext } from "../../types";
import {
  backchannelLogoutHandler,
  createAuthHandler,
  createLoginCallbackHandler,
  createLoginHandler,
  createLogoutHandler,
  createRefreshMiddleware,
  createUserinfoHandler,
  errorHandler,
  identityHandler,
  loginSchema,
  logoutSchema,
  noopHandler,
} from "./auth";
import { createLogoutCallbackHandler } from "./auth/logout-callback-handler";

export const createAuthRouter = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  const refreshMiddleware = createRefreshMiddleware(config);
  const forceRefresh = createRefreshMiddleware(
    merge(config, { refresh: { mode: "force" } }),
  );

  router.get("/", refreshMiddleware, createAuthHandler(config));

  router.post("/backchannel-logout", backchannelLogoutHandler);

  router.get("/error", errorHandler);

  router.get("/identity", refreshMiddleware, identityHandler);

  router.get("/login", useSchema(loginSchema), createLoginHandler(config));

  router.get("/login/callback", createLoginCallbackHandler(config));

  router.get("/logout", useSchema(logoutSchema), createLogoutHandler(config));

  router.get("/logout/callback", createLogoutCallbackHandler(config));

  router.get("/refresh", forceRefresh, noopHandler);

  router.get("/userinfo", refreshMiddleware, createUserinfoHandler(config));

  return router;
};
