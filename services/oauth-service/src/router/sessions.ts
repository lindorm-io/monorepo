// import { IdentityPermission } from "../common";
import { Router } from "@lindorm-io/koa";
// import { Router, useController, useSchema } from "@lindorm-io/koa";
// import {
//   authenticationConfirmationTokenMiddleware,
//   identityAuthMiddleware,
//   idTokenMiddleware,
// } from "../middleware";
// import {
//   initialiseSessionAuthenticationController,
//   initialiseSessionAuthenticationSchema,
//   updateSessionAuthenticationController,
//   updateSessionAuthenticationSchema,
// } from "../controller/sessions";
//

const router = new Router<any, any>();
export default router;

router.get("/", async (ctx) => {
  ctx.status = 204;
  ctx.body = undefined;
});

//
// router.post(
//   "/authenticate",
//   useSchema(initialiseSessionAuthenticationSchema),
//   identityAuthMiddleware(),
//   idTokenMiddleware("data.idTokenHint", { optional: true }),
//   useController(initialiseSessionAuthenticationController),
// );
//
// router.put(
//   "/authenticate",
//   useSchema(updateSessionAuthenticationSchema),
//   identityAuthMiddleware(),
//   authenticationConfirmationTokenMiddleware("data.authToken", {
//     fromPath: { subject: "token.bearerToken.subject" },
//   }),
//   useController(updateSessionAuthenticationController),
// );
