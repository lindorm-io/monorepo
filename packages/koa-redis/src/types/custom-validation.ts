import { DefaultLindormKoaContext } from "@lindorm-io/koa";
import { LindormEntity } from "@lindorm-io/entity";

export type CachedEntityCustomValidation<
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
  Entity extends LindormEntity<any> = LindormEntity<any>,
> = (ctx: Context, entity: Entity) => Promise<void>;
