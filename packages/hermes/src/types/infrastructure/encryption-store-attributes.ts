import {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosEncryption,
  KryptosType,
} from "@lindorm/kryptos";

export interface EncryptionStoreAttributes {
  id: string;
  name: string;
  context: string;
  key_id: string;
  key_algorithm: KryptosAlgorithm;
  key_curve: KryptosCurve | null;
  key_encryption: KryptosEncryption;
  key_type: KryptosType;
  private_key: string;
  public_key: string;
  timestamp: Date;
}
