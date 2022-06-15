import { IdentityPermission } from "../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { authenticationConfirmationTokenMiddleware, identityAuthMiddleware } from "../middleware";
import {
  updateSessionAuthenticationController,
  updateSessionAuthenticationSchema,
} from "../controller/sessions";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.put(
  "/authenticate",
  useSchema(updateSessionAuthenticationSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),
  authenticationConfirmationTokenMiddleware("data.authToken", {
    fromPath: { subject: "token.bearerToken.subject" },
  }),
  useController(updateSessionAuthenticationController),
);
