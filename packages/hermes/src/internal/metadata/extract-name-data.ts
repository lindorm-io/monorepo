import { snakeCase } from "@lindorm/case";

export type NameData = {
  name: string;
  version: number;
};

const R_VERSION_DIGIT = /_[vV]\d+$/;

export const extractNameData = (input: string): NameData => {
  const match = R_VERSION_DIGIT.exec(input);

  if (match) {
    const name = snakeCase(input.slice(0, match.index));
    const version = parseInt(match[0].replace(/_[vV]/, ""), 10);
    return { name, version };
  }

  return { name: snakeCase(input), version: 1 };
};
