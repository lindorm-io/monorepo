import { ZodObject } from "zod";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "../utils";

export function Schema(schema: ZodObject<IMessage>): ClassDecorator {
  return function (target) {
    globalMessageMetadata.addSchema({
      target,
      schema,
    });
  };
}
