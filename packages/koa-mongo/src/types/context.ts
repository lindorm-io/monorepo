import { EntityAttributes, LindormEntity } from "@lindorm-io/entity";
import { LindormRepository, MongoConnection } from "@lindorm-io/mongo";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormMongoContext extends DefaultLindormContext {
  connection: {
    mongo: MongoConnection;
  };
  entity: Record<string, LindormEntity<EntityAttributes>>;
  repository: Record<string, LindormRepository<EntityAttributes, LindormEntity<EntityAttributes>>>;
}

export type DefaultLindormMongoKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormMongoContext>
>;

export type DefaultLindormMongoSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormMongoContext>
>;
