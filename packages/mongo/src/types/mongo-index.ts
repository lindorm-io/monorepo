import { Dict } from "@lindorm/types";
import type { CreateIndexesOptions, Document, IndexDirection } from "mongodb";

export type MongoIndexOptions<D extends Document = Document> = {
  index: {
    [key in keyof D]?: IndexDirection;
  } & Dict<IndexDirection>;
  finite?: Array<keyof D | string>;
  name?: string;
  nullable?: Array<keyof D | string>;
  options?: Omit<CreateIndexesOptions, "name" | "unique">;
  unique?: boolean;
};
