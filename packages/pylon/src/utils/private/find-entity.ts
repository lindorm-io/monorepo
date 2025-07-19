import { globalEntityMetadata, IEntity } from "@lindorm/entity";
import { ClientError, ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { get } from "object-path";
import { PylonCommonContext, PylonEntitySourceName, SearchPath } from "../../types";
import { getCtxRepository } from "./get-ctx-repository";

type Options = {
  mandatory: boolean;
  path: SearchPath<Constructor<IEntity>>;
  source?: PylonEntitySourceName;
};

export const findEntity = async <C extends PylonCommonContext>(
  ctx: C,
  target: Constructor<IEntity>,
  options: Options,
): Promise<IEntity | null> => {
  const { mandatory, path } = options;

  const metadata = globalEntityMetadata.get(target);

  const primaryKey = metadata.columns.find((c) => c.decorator === "PrimaryKeyColumn");

  if (isString(path) && !primaryKey?.key) {
    throw new ServerError("@PrimaryKeyColumn not set on @Entity", {
      details: "String path cannot be used",
      debug: { path: path },
    });
  }

  const paths: Dict = isObject(path) ? path : { [primaryKey!.key]: path };
  const filter: Dict = {};

  for (const [key, objectPath] of Object.entries(paths)) {
    filter[key] = get(ctx, objectPath);
  }

  const noValues = Object.values(filter).every((value) => value === undefined);

  if (noValues && !mandatory) {
    return null;
  }

  if (noValues) {
    throw new ClientError("Invalid value for repository query", {
      debug: { path, paths, filter },
    });
  }

  return await getCtxRepository(ctx, target, options).findOne(filter);
};
