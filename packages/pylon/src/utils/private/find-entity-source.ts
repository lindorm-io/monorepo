import { globalEntityMetadata, IEntity } from "@lindorm/entity";
import { ServerError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { PylonCommonContext, PylonEntitySourceName } from "../../types";

type Options = {
  source?: PylonEntitySourceName;
};

export const findEntitySource = <C extends PylonCommonContext>(
  ctx: C,
  target: Constructor<IEntity>,
  options: Options,
): PylonEntitySourceName => {
  if (options.source) {
    ctx.logger.debug("Using provided source", { source: options.source });

    return options.source;
  }

  const metadata = globalEntityMetadata.get(target);

  if (metadata.primarySource) {
    ctx.logger.debug("Using primary source from metadata", {
      source: metadata.primarySource,
    });

    return metadata.primarySource;
  }

  const sources: Array<PylonEntitySourceName> = [];

  if (ctx.mnemos?.source.hasEntity(target)) {
    sources.push(ctx.mnemos.source.name);
  }
  if (ctx.mongo?.source.hasEntity(target)) {
    sources.push(ctx.mongo.source.name);
  }
  if (ctx.redis?.source.hasEntity(target)) {
    sources.push(ctx.redis.source.name);
  }

  if (sources.length === 0) {
    throw new ServerError("No source defined for entity");
  }

  if (sources.length > 1) {
    throw new ServerError("Multiple sources defined for entity", {
      details: "Please specify a source explicitly",
      debug: { sources },
    });
  }

  ctx.logger.debug("Using available source", { source: sources[0] });

  return sources[0];
};
