export interface DeviceLinkSalt {
  aes: string;
  hmac: string;
}

export interface DeviceMetadata {
  brand: string | null;
  buildId: string | null;
  buildNumber: string | null;
  macAddress: string | null;
  model: string | null;
  systemName: string | null;
}
