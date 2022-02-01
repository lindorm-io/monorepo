export interface GetIdentityDeviceLinksResponseBody {
  deviceLinks: Array<string>;
}

export interface InitialiseRdcSessionResponseBody {
  id: string;
  expiresIn: number;
}
