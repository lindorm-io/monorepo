import { KoaContext } from "@lindorm-io/koa";
import { RedisContext } from "./context";
import { LindormEntity } from "@lindorm-io/entity";

export type CustomValidation<
  Context extends KoaContext = RedisContext,
  Entity extends LindormEntity<any> = LindormEntity<any>,
> = (ctx: Context, entity: Entity) => Promise<void>;
