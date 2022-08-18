import { Data, IMessage, MessageOptions } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class ErrorMessage<D extends Data = Data> extends MessageBase<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: IMessage) {
    super({ ...options, type: MessageType.ERROR_MESSAGE }, causation);
  }
}
