import { DefaultState } from "koa";
import Router, { IRouterOptions } from "koa-router";
import { httpParamsParserMiddleware } from "../middleware/private";
import { PylonHttpContext, PylonHttpMiddleware } from "../types";

export class PylonRouter<C extends PylonHttpContext = PylonHttpContext> {
  private readonly _router: Router<DefaultState, C>;

  public constructor(options?: IRouterOptions) {
    this._router = new Router<DefaultState, C>(options);
  }

  public allowedMethods(): PylonHttpMiddleware<C> {
    return this._router.allowedMethods() as PylonHttpMiddleware<C>;
  }

  public middleware(): PylonHttpMiddleware<C> {
    return this._router.middleware() as PylonHttpMiddleware<C>;
  }

  public routes(): PylonHttpMiddleware<C> {
    return this._router.routes() as PylonHttpMiddleware<C>;
  }

  public get stack(): Router.Layer[] {
    return this._router.stack;
  }

  public use(...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C>;
  public use(
    path: string | Array<string>,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C>;
  public use(...args: any): PylonRouter<C> {
    this._router.use(...args);
    return this;
  }

  public get(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.get(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.get(path, ...middleware);
    }
    return this;
  }

  public post(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.post(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.post(path, ...middleware);
    }
    return this;
  }

  public put(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.put(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.put(path, ...middleware);
    }
    return this;
  }

  public link(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.link(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.link(path, ...middleware);
    }
    return this;
  }

  public unlink(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.unlink(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.unlink(path, ...middleware);
    }
    return this;
  }

  public delete(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.delete(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.delete(path, ...middleware);
    }
    return this;
  }

  public head(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.head(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.head(path, ...middleware);
    }
    return this;
  }

  public options(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.options(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.options(path, ...middleware);
    }
    return this;
  }

  public patch(
    path: string,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.patch(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.patch(path, ...middleware);
    }
    return this;
  }

  public all(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.all(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.all(path, ...middleware);
    }
    return this;
  }
}
