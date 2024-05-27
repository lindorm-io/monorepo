import { IAmphora } from "@lindorm/amphora";
import {
  LindormWorker,
  LindormWorkerCallback,
  LindormWorkerOptions,
} from "@lindorm/worker";

type Options = Omit<LindormWorkerOptions, "alias" | "callback"> & {
  amphora: IAmphora;
};

export class AmphoraWorker extends LindormWorker {
  public constructor(options: Options) {
    super({
      ...options,
      alias: "AmphoraWorker",
      callback: AmphoraWorker.callback(options.amphora),
    });
  }

  private static callback(amphora: IAmphora): LindormWorkerCallback {
    return async () => {
      await amphora.setup();
      await amphora.refresh();
    };
  }
}
