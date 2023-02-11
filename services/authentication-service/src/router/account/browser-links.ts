import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
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

const router = new Router<any, any>();
export default router;

router.post(
  "/",
  useSchema(linkAccountToBrowserSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(linkAccountToBrowserController),
);

router.get(
  "/",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
  }),
  useController(getBrowserLinksController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteBrowserLinkSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
  }),
  browserLinkEntityMiddleware("data.id"),
  useController(deleteBrowserLinkController),
);
