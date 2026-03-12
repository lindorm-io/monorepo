import { Logger } from "@lindorm/logger";
import { ProteusSource } from "../src";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import { Tag } from "./entities/Tag";

export const source = new ProteusSource({
  driver: "postgres",
  url: "postgres://root:example@localhost:5432/default",
  entities: [User, Post, Tag],
  namespace: undefined,
  migrationsTable: undefined,
  logger: new Logger({ level: "warn", readable: true }),
});
