import { Router, useController, useSchema } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import { deleteTotpController, deleteTotpSchema, generateTotpController } from "../../controller";

const router = new Router();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    adjustedAccessLevel: 2,
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateTotpController),
);

router.delete(
  "/",
  useSchema(deleteTotpSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 2,
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(deleteTotpController),
);
