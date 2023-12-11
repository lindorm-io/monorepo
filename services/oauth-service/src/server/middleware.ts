import { DefaultLindormMiddleware } from "@lindorm-io/koa";
import { accessControlMiddleware } from "../middleware";

export const middleware: Array<DefaultLindormMiddleware> = [accessControlMiddleware];
