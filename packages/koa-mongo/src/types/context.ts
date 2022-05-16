import { MongoConnection } from "@lindorm-io/mongo";
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
}

export type DefaultLindormMongoKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormMongoContext>
>;

export type DefaultLindormMongoSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormMongoContext>
>;
