import { existsSync, readdirSync } from "fs";
import { extname, join } from "path";

export const getFiles = (input: string): Array<string> => {
  const isDirectory = existsSync(input) && !extname(input);
  const isFile = existsSync(input) && extname(input);

  if (isDirectory) {
    return readdirSync(input).map((file) => join(input, file));
  }
  if (isFile) {
    return [input];
  }

  throw new Error(`Input must be a directory or a file: ${input}`);
};
