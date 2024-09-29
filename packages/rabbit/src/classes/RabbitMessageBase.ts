import { dotCase } from "@lindorm/case";
import { isBoolean, isDate, isNumber, isString } from "@lindorm/is";
import { randomUUID } from "crypto";
import { IRabbitMessage } from "../interfaces";

export class RabbitMessageBase implements IRabbitMessage {
  public readonly id: string;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly timestamp: Date;
  public readonly type: string;

  public constructor(options: Partial<IRabbitMessage> = {}) {
    this.id = isString(options.id) ? options.id : randomUUID();

    this.delay = isNumber(options.delay) ? options.delay : 0;

    this.mandatory = isBoolean(options.mandatory) ? options.mandatory : false;

    this.timestamp = isDate(options.timestamp)
      ? options.timestamp
      : isString(options.timestamp)
        ? new Date(options.timestamp)
        : new Date();

    this.type = isString(options.type) ? options.type : this.constructor.name;
  }

  public get topic(): string {
    return dotCase(this.type);
  }
}
