import { ServerKoaContext } from "../../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { loginSessionCookieMiddleware } from "../../../middleware";
import {
  createLoginSessionController,
  createLoginSessionSchema,
  getLoginController,
  rejectLoginController,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post("/", useSchema(createLoginSessionSchema), useController(createLoginSessionController));

router.get("/", loginSessionCookieMiddleware, useController(getLoginController));

router.put("/reject", loginSessionCookieMiddleware, useController(rejectLoginController));
