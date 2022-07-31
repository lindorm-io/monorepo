import { IAmqpConnection } from "@lindorm-io/amqp";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormAmqpContext extends DefaultLindormContext {
  connection: {
    amqp: IAmqpConnection;
  };
}

export type DefaultLindormAmqpKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormAmqpContext>
>;

export type DefaultLindormAmqpSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormAmqpContext>
>;
