/**
 * Ambient declaration for tsx/cjs/api.
 *
 * This exists because moduleResolution: "node" cannot resolve tsx's
 * .d.cts / .d.mts conditional exports. The tsx package ships types
 * under "exports" conditions that only work with moduleResolution
 * "bundler" or "node16".
 *
 * This file can be removed when the project upgrades to
 * moduleResolution: "bundler" or "node16".
 */
declare module "tsx/cjs/api" {
  export const require: {
    (id: string, fromFile: string | URL): any;
    resolve: {
      (
        id: string,
        fromFile: string | URL,
        options?: { paths?: string[] | undefined },
      ): string;
      paths: (request: string) => string[] | null;
    };
    main: NodeJS.Module | undefined;
    extensions: NodeJS.RequireExtensions;
    cache: NodeJS.Dict<NodeJS.Module>;
  };
}
