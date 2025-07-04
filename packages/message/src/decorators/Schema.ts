import { Constructor } from "@lindorm/types";
import z, { ZodObject, ZodRawShape } from "zod";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "../utils";

export function Schema<T extends ZodObject<ZodRawShape>>(
  schema: T,
): <C extends Constructor<IMessage & z.infer<T>>>(ctor: C) => void {
  return function <C extends Constructor<IMessage & z.infer<T>>>(target: C) {
    globalMessageMetadata.addSchema({
      target,
      schema,
    });
  };
}
