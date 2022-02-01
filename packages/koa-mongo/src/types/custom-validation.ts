import { KoaContext } from "@lindorm-io/koa";
import { LindormEntity } from "@lindorm-io/entity";
import { MongoContext } from "./context";

export type CustomValidation<
  Context extends KoaContext = MongoContext,
  Entity extends LindormEntity<any> = LindormEntity<any>,
> = (ctx: Context, entity: Entity) => Promise<void>;
