import { ComposedMiddleware, Dispatch, Middleware, Next } from "../../types";

export const createDispatcher =
  <Context>(middleware: Array<Middleware<Context>>): ComposedMiddleware<Context> =>
  (context: Context, next?: Next): Promise<void> => {
    let index = -1;

    const dispatch: Dispatch = (i: number) => {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }

      index = i;

      let mw = middleware[i];

      if (i === middleware.length) {
        mw = next as Middleware<Context>;
      }

      if (!mw) {
        return Promise.resolve();
      }

      try {
        return Promise.resolve(mw(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err as Error);
      }
    };

    return dispatch(0);
  };
