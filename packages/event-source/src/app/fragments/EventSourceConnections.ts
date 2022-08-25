import { AppConnectionOptions } from "../../types";
import { IAmqpConnection } from "@lindorm-io/amqp";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";

export class EventSourceConnections {
  public readonly amqp: IAmqpConnection;
  public readonly mongo: IMongoConnection;
  public readonly postgres: IPostgresConnection;

  public constructor(options: AppConnectionOptions) {
    this.amqp = options.amqp;
    this.mongo = options.mongo;
    this.postgres = options.postgres;
  }
}
