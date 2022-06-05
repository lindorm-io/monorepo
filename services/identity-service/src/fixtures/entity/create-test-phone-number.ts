import { PhoneNumber, PhoneNumberOptions } from "../../entity";
import { randomUUID } from "crypto";
import { getRandomNumber } from "@lindorm-io/core";

export const createTestPhoneNumber = (options: Partial<PhoneNumberOptions> = {}): PhoneNumber =>
  new PhoneNumber({
    identityId: randomUUID(),
    phoneNumber: `+4670${getRandomNumber(7)}`,
    primary: true,
    verified: true,
    ...options,
  });
