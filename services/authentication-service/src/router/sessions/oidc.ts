import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { confirmOidcController, confirmOidcSchema } from "../../controller";

export const router = new Router<any, any>();

router.get(
  "/callback",
  paramsMiddleware,
  useSchema(confirmOidcSchema),
  useController(confirmOidcController),
);
