import { ServerKoaContext } from "../../types";
import { Router, useController } from "@lindorm-io/koa";
import { logoutSessionCookieMiddleware } from "../../middleware";
import {
  confirmLogoutController,
  getLogoutInfoController,
  rejectLogoutController,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get("/", logoutSessionCookieMiddleware, useController(getLogoutInfoController));

router.put("/confirm", logoutSessionCookieMiddleware, useController(confirmLogoutController));

router.put("/reject", logoutSessionCookieMiddleware, useController(rejectLogoutController));
