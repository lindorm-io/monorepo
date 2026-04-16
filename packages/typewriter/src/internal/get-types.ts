import { ILogger } from "@lindorm/logger";
import {
  InputData,
  jsonInputForTargetLanguage,
  quicktype,
  SerializedRenderResult,
} from "quicktype-core";

type Options = {
  logger: ILogger;
  output?: "typescript" | "typescript-zod";
  samples: Array<string>;
  typeName: string;
};

export const getTypes = async (options: Options): Promise<SerializedRenderResult> => {
  const lang = options.output ?? "typescript";

  const jsonInput = jsonInputForTargetLanguage(lang);
  await jsonInput.addSource({
    name: options.typeName,
    samples: options.samples,
  });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  options.logger.verbose(`Generating types for [ ${options.typeName} ] in [ ${lang} ]`);

  return await quicktype({
    inputData,
    indentation: "  ",
    lang,
    alphabetizeProperties: true,
    rendererOptions: { "just-types": "true" },
  });
};
