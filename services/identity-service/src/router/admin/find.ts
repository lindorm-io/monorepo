import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { findIdentityController, findIdentitySchema } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/",
  paramsMiddleware,
  useSchema(findIdentitySchema),
  useController(findIdentityController),
);
