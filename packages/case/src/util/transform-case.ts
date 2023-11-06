import { TransformMode } from "../enums/TransformMode";
import { CaseInput } from "../types";
import { camelCase } from "./camel-case";
import { capitalCase } from "./capital-case";
import { constantCase } from "./constant-case";
import { dotCase } from "./dot-case";
import { kebabCase } from "./kebab-case";
import { pascalCase } from "./pascal-case";
import { snakeCase } from "./snake-case";

export const transformCase = <T>(input: CaseInput, mode: TransformMode = TransformMode.NONE): T => {
  switch (mode) {
    case TransformMode.CAMEL:
      return camelCase(input);

    case TransformMode.CAPITAL:
      return capitalCase(input);

    case TransformMode.CONSTANT:
      return constantCase(input);

    case TransformMode.DOT:
      return dotCase(input);

    case TransformMode.KEBAB:
      return kebabCase(input);

    case TransformMode.PASCAL:
      return pascalCase(input);

    case TransformMode.SNAKE:
      return snakeCase(input);

    case TransformMode.NONE:
      return input as T;

    default:
      throw new Error(`Invalid transform mode [ ${mode} ]`);
  }
};
