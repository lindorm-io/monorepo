import { IdentifierField, TimestampField } from "../decorators";
import { IMessageBase } from "../interfaces";

export abstract class MessageBase implements IMessageBase {
  @IdentifierField()
  public readonly id!: string;

  @TimestampField()
  public readonly timestamp!: Date;
}
