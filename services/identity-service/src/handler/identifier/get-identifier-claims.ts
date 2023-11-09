import { IdentifierType } from "@lindorm-io/common-enums";
import { filter, orderBy } from "lodash";
import { Identity } from "../../entity";
import { ServerKoaContext } from "../../types";

type Result = {
  email: string | null;
  emailVerified: boolean;
  nationalIdentityNumber: string | null;
  nationalIdentityNumberVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  socialSecurityNumber: string | null;
  socialSecurityNumberVerified: boolean;
};

const EMPTY: Result = {
  email: null,
  emailVerified: false,
  nationalIdentityNumber: null,
  nationalIdentityNumberVerified: false,
  phoneNumber: null,
  phoneNumberVerified: false,
  socialSecurityNumber: null,
  socialSecurityNumberVerified: false,
};

export const getIdentifierClaims = async (
  ctx: ServerKoaContext,
  identity: Identity,
): Promise<Result> => {
  const {
    logger,
    mongo: { identifierRepository },
  } = ctx;

  const data: Result = {
    ...EMPTY,
  };

  try {
    const array = await identifierRepository.findMany({ identityId: identity.id });
    if (!array.length) return data;

    const ordered = orderBy(array, ["primary", "verified", "updated"], ["desc", "desc", "desc"]);

    const [email] = filter(ordered, { type: IdentifierType.EMAIL });
    if (email) {
      data.email = email.value;
      data.emailVerified = email.verified;
    }

    const [nin] = filter(ordered, { type: IdentifierType.NIN });
    if (nin) {
      data.nationalIdentityNumber = nin.value;
      data.nationalIdentityNumberVerified = nin.verified;
    }

    const [phone] = filter(ordered, { type: IdentifierType.PHONE });
    if (phone) {
      data.phoneNumber = phone.value;
      data.phoneNumberVerified = phone.verified;
    }

    const [ssn] = filter(ordered, { type: IdentifierType.SSN });
    if (ssn) {
      data.socialSecurityNumber = ssn.value;
      data.socialSecurityNumberVerified = ssn.verified;
    }

    return data;
  } catch (err: any) {
    logger.warn("Identifier userinfo error", err);
    return data;
  }
};
