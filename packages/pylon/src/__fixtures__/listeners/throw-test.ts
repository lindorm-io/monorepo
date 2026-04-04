import { ServerError } from "@lindorm/errors";

export const throwHandler = async () => {
  throw new ServerError("intentional error", { code: "test_throw" });
};
export const ON = throwHandler;
