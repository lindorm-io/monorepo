import { MongoConnection } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/winston";
import { config } from "dotenv";

config();

export const getMongo = (winston: Logger): MongoConnection =>
  new MongoConnection({
    host: process.env.MONGO_HOST,
    port: parseInt(process.env.MONGO_PORT, 10),
    auth: {
      username: process.env.MONGO_USERNAME,
      password: process.env.MONGO_PASSWORD,
    },
    database: process.env.MONGO_DB_NAME,
    winston,
  });
