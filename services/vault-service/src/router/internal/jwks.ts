import { Router, useController } from "@lindorm-io/koa";
import { getPrivateJwksController } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get("/", useController(getPrivateJwksController));
