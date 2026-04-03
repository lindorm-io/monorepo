import { Constructor } from "@lindorm/types";

export type PylonSubscribeOptions = {
  topic: string;
  callback: (...args: Array<any>) => Promise<void>;
};

export type SearchPath<E extends Constructor> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;
