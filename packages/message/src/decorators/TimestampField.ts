import { globalMessageMetadata } from "../utils";

export function TimestampField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "TimestampField",
      enum: null,
      fallback: () => new Date(),
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      type: "date",
    });
  };
}
