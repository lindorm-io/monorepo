import { ZodObject } from "zod";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "../utils";

export function Schema(schema: ZodObject<IEntity>): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addSchema({
      target,
      schema,
    });
  };
}
