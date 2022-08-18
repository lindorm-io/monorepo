import { Data, IMessage, MessageOptions } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class TimeoutMessage<D extends Data = Data> extends MessageBase<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: IMessage) {
    super({ ...options, mandatory: true, type: MessageType.TIMEOUT_MESSAGE }, causation);
  }
}
