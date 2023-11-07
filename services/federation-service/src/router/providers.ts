import { Router, useController } from "@lindorm-io/koa";
import { getProvidersListController } from "../controller";

export const router = new Router<any, any>();

router.get("/", useController(getProvidersListController));
