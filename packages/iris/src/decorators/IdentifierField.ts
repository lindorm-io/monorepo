import { randomUUID } from "@lindorm/random";
import { stageField } from "../internal/message/metadata/stage-metadata";

export const IdentifierField =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "IdentifierField",
      default: () => randomUUID(),
      enum: null,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      transform: null,
      type: "uuid",
    });
  };
