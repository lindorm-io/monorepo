import { randomUUID } from "crypto";
import { globalMessageMetadata } from "../utils";

export function CorrelationField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "CorrelationField",
      enum: null,
      fallback: () => randomUUID(),
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      type: "uuid",
    });
  };
}
