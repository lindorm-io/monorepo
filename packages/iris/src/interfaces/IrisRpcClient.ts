import type { IMessage } from "./Message.js";

export interface IIrisRpcClient<
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
> {
  request(message: Req, options?: { timeout?: number }): Promise<Res>;
  close(): Promise<void>;
}
