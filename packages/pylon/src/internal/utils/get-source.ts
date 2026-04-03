import { LindormError } from "@lindorm/errors";
import { PylonSource } from "../../types";

export const getSource = <T extends PylonSource>(
  sources: Map<string, PylonSource>,
  name: string,
): T => {
  const source = sources.get(name);

  if (!source) {
    throw new LindormError(`Source not found: ${name}`);
  }

  return source as T;
};
