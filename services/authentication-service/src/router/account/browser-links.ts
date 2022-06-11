import { IdentityPermission, Scope } from "../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import {
  accountEntityMiddleware,
  browserLinkEntityMiddleware,
  identityAuthMiddleware,
} from "../../middleware";
import {
  deleteBrowserLinkController,
  deleteBrowserLinkSchema,
  getBrowserLinksController,
  linkAccountToBrowserController,
  linkAccountToBrowserSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(linkAccountToBrowserSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(linkAccountToBrowserController),
);

router.get(
  "/",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  useController(getBrowserLinksController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteBrowserLinkSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  browserLinkEntityMiddleware("data.id"),
  useController(deleteBrowserLinkController),
);
