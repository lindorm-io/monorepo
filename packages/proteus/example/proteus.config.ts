import { Logger } from "@lindorm/logger";
import { ProteusSource } from "../src/index.js";
import { User } from "./entities/User.js";
import { Post } from "./entities/Post.js";
import { Tag } from "./entities/Tag.js";

export const source = new ProteusSource({
  driver: "postgres",
  url: "postgres://root:example@localhost:5432/default",
  entities: [User, Post, Tag],
  namespace: undefined,
  migrationsTable: undefined,
  logger: new Logger({ level: "warn", readable: true }),
});
