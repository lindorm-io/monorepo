export type GenerateMessageOptions = {
  name: string;
};

export const generateMessageSource = (options: GenerateMessageOptions): string => {
  const { name } = options;

  return [
    `import { Field, Message } from "@lindorm/iris";`,
    ``,
    `@Message()`,
    `export class ${name} {`,
    `  @Field("string")`,
    `  body!: string;`,
    `}`,
    ``,
  ].join("\n");
};

export const IRIS_MESSAGE_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;
