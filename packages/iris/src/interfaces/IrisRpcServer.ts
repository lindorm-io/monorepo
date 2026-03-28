import type { IMessage } from "./Message";

export interface IIrisRpcServer<
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
> {
  serve(
    handler: (request: Req) => Promise<Res>,
    options?: { queue?: string },
  ): Promise<void>;
  unserve(options?: { queue?: string }): Promise<void>;
  unserveAll(): Promise<void>;
}
