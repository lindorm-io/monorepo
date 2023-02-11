import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { getProvidersListController } from "../controller";
import { useController } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.get("/", useController(getProvidersListController));
