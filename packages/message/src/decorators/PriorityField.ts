import { globalMessageMetadata } from "../utils";

export function PriorityField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "PriorityField",
      enum: null,
      fallback: 1,
      max: null,
      min: 0,
      nullable: false,
      optional: false,
      schema: null,
      type: "integer",
    });
  };
}
