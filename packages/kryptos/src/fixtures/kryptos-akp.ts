import { IKryptosAkp } from "../interfaces";
import { KryptosKit } from "../classes";
import {
  TEST_AKP_KEY_ML_DSA_44_B64,
  TEST_AKP_KEY_ML_DSA_65_B64,
  TEST_AKP_KEY_ML_DSA_87_B64,
} from "../__fixtures__/akp-keys";

export const KRYPTOS_AKP_SIG_ML_DSA_44 = KryptosKit.from.b64({
  ...TEST_AKP_KEY_ML_DSA_44_B64,
  id: "4aa7b7bb-4f3a-48b0-8140-61f22013a41a",
}) as IKryptosAkp;

export const KRYPTOS_AKP_SIG_ML_DSA_65 = KryptosKit.from.b64({
  ...TEST_AKP_KEY_ML_DSA_65_B64,
  id: "5b89cf82-80ab-4361-9a2d-85cbb17c74cc",
}) as IKryptosAkp;

export const KRYPTOS_AKP_SIG_ML_DSA_87 = KryptosKit.from.b64({
  ...TEST_AKP_KEY_ML_DSA_87_B64,
  id: "6cf6e49a-f8a9-4be8-9f56-d8cf98f9f51e",
}) as IKryptosAkp;
