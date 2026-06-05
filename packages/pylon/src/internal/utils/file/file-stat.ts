import { ServerError } from "@lindorm/errors";
import { Stats } from "fs";
import { stat } from "fs/promises";

export const fileStat = async (path: string): Promise<Stats> => {
  try {
    return await stat(path);
  } catch (error: any) {
    throw new ServerError("Unable to stat file", {
      code: "file_stat_failed",
      type: "urn:lindorm:pylon:error:file_stat_failed",
      error,
      debug: { path },
    });
  }
};
