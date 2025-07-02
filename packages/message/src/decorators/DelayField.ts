import { globalMessageMetadata } from "../utils";

export function DelayField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "DelayField",
      enum: null,
      fallback: 0,
      max: null,
      min: 0,
      nullable: false,
      optional: false,
      schema: null,
      type: "integer",
    });
  };
}
