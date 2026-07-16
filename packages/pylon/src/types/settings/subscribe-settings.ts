export type PylonSubscribeSettings = {
  topic: string;
  callback: (...args: Array<any>) => Promise<void>;
};
