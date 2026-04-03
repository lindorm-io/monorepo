import { PylonRouter } from "../../classes";

export const router = new PylonRouter();
router.get("/", async (_ctx: any, next: any) => {
  await next();
});
