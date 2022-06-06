import { Identifier } from "../entity";
import { uniqBy } from "lodash";
import { configuration } from "../server/configuration";

export const getListOfConnectedProviders = (identifiers: Array<Identifier>): Array<string> =>
  uniqBy(identifiers, "provider")
    .map((item) => item.provider)
    .filter((item) => item !== configuration.server.domain);
