import { RepositoryOptions } from "./repository";

export type QueryCallback = (options: RepositoryOptions) => Promise<void>;
