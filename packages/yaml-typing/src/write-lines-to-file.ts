import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";

const getModifiedLine = (line: string, fileName: string, requireAll: boolean): string => {
  let result = line + "\n";

  if (line.startsWith("export interface") && !line.includes(fileName)) {
    result = result.replace("export ", "");
  }

  if (requireAll) {
    result = result.replace("?: ", ":  ");
  }

  return result;
};

interface Options {
  requireAll: boolean;
  root: string;
  write: string;
}

export const writeLinesToFile = (
  fileName: string,
  lines: Array<string>,
  options: Partial<Options> = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { requireAll = true, root = __dirname, write = "" } = options;

    const writeDir = join(root, write);
    const writeFile = join(writeDir, `${fileName}.generated.ts`);

    if (!existsSync(writeDir)) {
      mkdirSync(writeDir);
    }

    const stream = createWriteStream(writeFile);

    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));

    for (const line of lines) {
      stream.write(getModifiedLine(line, fileName, requireAll));
    }

    stream.end();
  });
};
