import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { getIdentityDeviceLinksController, getIdentityDeviceLinksSchema } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id/device-links",
  paramsMiddleware,
  useSchema(getIdentityDeviceLinksSchema),
  useController(getIdentityDeviceLinksController),
);
