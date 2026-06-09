import { ServerError } from "@lindorm/errors";
import type { IIrisSource } from "@lindorm/iris";
import type { IProteusSource } from "@lindorm/proteus";
import type { PylonHttpCallback, PylonHttpContext } from "../../types/index.js";

type BuildDefaultHealthCallbackOptions = {
  iris?: IIrisSource;
  proteus?: IProteusSource;
};

export const buildDefaultHealthCallback = <C extends PylonHttpContext>({
  iris,
  proteus,
}: BuildDefaultHealthCallbackOptions): PylonHttpCallback<C> | undefined => {
  if (!iris && !proteus) return undefined;

  return async () => {
    const failures: Array<string> = [];

    if (proteus) {
      try {
        const ok = await proteus.ping();
        if (!ok) failures.push("proteus");
      } catch {
        failures.push("proteus");
      }
    }

    if (iris) {
      try {
        const ok = await iris.ping();
        if (!ok) failures.push("iris");
      } catch {
        failures.push("iris");
      }
    }

    if (failures.length > 0) {
      throw new ServerError("One or more health checks failed", {
        code: "health_check_failed",
        title: "Health Check Failed",
        details: `One or more upstream sources failed their health check: ${failures.join(", ")}.`,
        type: "urn:lindorm:pylon:error:health_check_failed",
        data: { failures },
        status: ServerError.Status.ServiceUnavailable,
      });
    }
  };
};
