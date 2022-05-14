import { DefaultLindormSocketMiddleware, LindormSocketPromise } from "../../types";

export const promisifyLindormSocketMiddleware =
  <Options = any>(
    promise: LindormSocketPromise<Options>,
    options: Options,
  ): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    promise(socket, options)
      .then(() => next())
      .catch((err) => next(err));
  };
