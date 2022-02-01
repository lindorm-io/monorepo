import type { SerializedRenderResult } from "quicktype-core";
import { InputData, jsonInputForTargetLanguage, quicktype } from "quicktype-core";

export const getTyping = async (
  fileName: string,
  samples: Array<string>,
): Promise<SerializedRenderResult> => {
  const jsonInput = jsonInputForTargetLanguage("typescript");

  await jsonInput.addSource({
    name: fileName,
    samples,
  });

  const inputData = new InputData();

  inputData.addInput(jsonInput);

  return await quicktype({
    inputData,
    indentation: "  ",
    lang: "typescript",
    alphabetizeProperties: true,
    rendererOptions: { "just-types": "true" },
  });
};
