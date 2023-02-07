import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { filter, orderBy } from "lodash";
import { getListOfConnectedProviders } from "../../util";
import { IdentifierTypes } from "@lindorm-io/common-types";

type Result = {
  connectedProviders: Array<string>;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
};

const EMPTY: Result = {
  connectedProviders: [],
  email: null,
  emailVerified: false,
  phoneNumber: null,
  phoneNumberVerified: false,
};

export const getIdentifierUserinfo = async (
  ctx: ServerKoaContext,
  identity: Identity,
): Promise<Result> => {
  const {
    logger,
    repository: { identifierRepository },
  } = ctx;

  const data: Result = {
    ...EMPTY,
  };

  try {
    const array = await identifierRepository.findMany({ identityId: identity.id });
    if (!array.length) return data;

    const ordered = orderBy(array, ["primary", "verified", "updated"], ["desc", "desc", "desc"]);

    data.connectedProviders = getListOfConnectedProviders(ordered);

    const [email] = filter(ordered, { type: IdentifierTypes.EMAIL });
    if (email) {
      data.email = email.identifier;
      data.emailVerified = email.verified;
    }

    const [phone] = filter(ordered, { type: IdentifierTypes.PHONE });
    if (phone) {
      data.phoneNumber = phone.identifier;
      data.phoneNumberVerified = phone.verified;
    }

    return data;
  } catch (err: any) {
    logger.warn("Identifier userinfo error", err);
    return data;
  }
};
