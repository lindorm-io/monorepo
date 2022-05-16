import { MongoConnection } from "@lindorm-io/mongo";
import { configuration } from "../server/configuration";
import { winston } from "../server/logger";

export const mongoConnection = new MongoConnection({
  host: configuration.mongo.host,
  port: configuration.mongo.port,
  auth: {
    username: configuration.mongo.username,
    password: configuration.mongo.password,
  },
  database: configuration.mongo.db_name,
  winston,
});
