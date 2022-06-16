import { IdentityPermission } from "../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import {
  authenticationConfirmationTokenMiddleware,
  identityAuthMiddleware,
  idTokenMiddleware,
} from "../middleware";
import {
  initialiseSessionAuthenticationController,
  initialiseSessionAuthenticationSchema,
  updateSessionAuthenticationController,
  updateSessionAuthenticationSchema,
} from "../controller/sessions";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/authenticate",
  useSchema(initialiseSessionAuthenticationSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(initialiseSessionAuthenticationController),
);

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
