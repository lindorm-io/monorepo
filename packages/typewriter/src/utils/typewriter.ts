import { ILogger, LoggerOptions } from "@lindorm/logger";
import { getLogger, getTypes, loadSamples, writeLinesToFile } from "./private";

type Options = {
  fileName?: string;
  input: Array<string>;
  logger?: ILogger | LoggerOptions;
  output?: "typescript" | "typescript-zod";
  samples?: Array<string>;
  typeName: string;
  writeToDirectory?: string;
};

export const typewriter = async (options: Options): Promise<string> => {
  const logger = getLogger(options.logger);

  const samples = loadSamples({
    input: options.input,
    logger,
    samples: options.samples,
  });

  const { lines } = await getTypes({
    logger,
    output: options.output,
    samples,
    typeName: options.typeName,
  });

  if (options.writeToDirectory) {
    await writeLinesToFile({
      fileName: options.fileName ?? options.typeName,
      lines,
      logger,
      writeToDirectory: options.writeToDirectory,
    });
  }

  return lines.join("\n");
};
