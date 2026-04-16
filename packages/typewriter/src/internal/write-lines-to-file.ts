import { ILogger } from "@lindorm/logger";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";

type Options = {
  fileName: string;
  lines: Array<string>;
  logger: ILogger;
  writeToDirectory: string;
};

export const writeLinesToFile = (options: Options): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = join(options.writeToDirectory, `${options.fileName}.typewriter.ts`);

    options.logger.verbose(`Writing type to file [ ${file} ]`);

    if (!existsSync(options.writeToDirectory)) {
      mkdirSync(options.writeToDirectory);
    }

    const stream = createWriteStream(file);

    stream.on("finish", () => {
      options.logger.verbose(`Type written to file [ ${file} ]`);
      resolve();
    });

    stream.on("error", (err) => {
      options.logger.error(`Failed to write type to file [ ${file} ]`, err);
      reject(err);
    });

    for (const line of options.lines) {
      stream.write(line + "\n");
    }

    stream.end();
  });
};
