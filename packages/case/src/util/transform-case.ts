import { CaseInput, TransformMode } from "../types";
import { camelCase } from "./camel-case";
import { constantCase } from "./constant-case";
import { dotCase } from "./dot-case";
import { headerCase } from "./header-case";
import { paramCase } from "./param-case";
import { pascalCase } from "./pascal-case";
import { snakeCase } from "./snake-case";

export const transformCase = (input: CaseInput, mode: TransformMode = "none") => {
  switch (mode) {
    case "camel":
      return camelCase(input);

    case "constant":
      return constantCase(input);

    case "dot":
      return dotCase(input);

    case "header":
      return headerCase(input);

    case "param":
      return paramCase(input);

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
