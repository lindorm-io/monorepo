import { EntityAttributes, LindormEntity } from "@lindorm-io/entity";
import { KoaContext } from "@lindorm-io/koa";
import { LindormRepository, MongoConnection } from "@lindorm-io/mongo";

export interface MongoContext extends KoaContext {
  connection: {
    mongo: MongoConnection;
  };
  entity: Record<string, LindormEntity<EntityAttributes>>;
  repository: Record<string, LindormRepository<EntityAttributes, LindormEntity<EntityAttributes>>>;
}
