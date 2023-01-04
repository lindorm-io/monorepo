import { CaseInput, TransformMode } from "../types";
import { camelCase } from "./camel-case";
import { kebabCase } from "./kebab-case";
import { pascalCase } from "./pascal-case";
import { snakeCase } from "./snake-case";

export const transformCase = (input: CaseInput, mode: TransformMode) => {
  switch (mode) {
    case "camel":
      return camelCase(input);

    case "kebab":
      return kebabCase(input);

    case "pascal":
      return pascalCase(input);

    case "snake":
      return snakeCase(input);

    case "none":
      return input;

    default:
      throw new Error(`Invalid transform mode [ ${mode} ]`);
  }
};
