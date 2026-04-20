import { IKryptosEc } from "../interfaces";
import { KryptosKit } from "../classes";

export const MOCK_KRYPTOS_EC_SIG_ES256 = KryptosKit.from.b64({
  id: "b3b62d67-9c48-4e3c-9efd-81f82f6b6551",
  algorithm: "ES256",
  curve: "P-256",
  type: "EC",
  use: "sig",
  privateKey:
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgXswmXs7C-dImprg4qbLH3aXPmtvu4AlVb3nGTYI6xoyhRANCAAR1qHyVNpUdxEuOgU0RgLj3yeT9m5PfjffxhrP6YvVBx1Dn_6qYllqfmB3JGmjKeM2sZFm_DZp8qVIMmPEyz_XZ",
  publicKey:
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdah8lTaVHcRLjoFNEYC498nk_ZuT34338Yaz-mL1QcdQ5_-qmJZan5gdyRpoynjNrGRZvw2afKlSDJjxMs_12Q",
}) as IKryptosEc;

export const MOCK_KRYPTOS_EC_SIG_ES384 = KryptosKit.from.b64({
  id: "a08382e3-20ba-4549-8378-f3a40920d86b",
  algorithm: "ES384",
  curve: "P-384",
  type: "EC",
  use: "sig",
  privateKey:
    "MIG2AgEAMBAGByqGSM49AgEGBSuBBAAiBIGeMIGbAgEBBDDsyvgZb7GADKRqWrDYxy_9-NmjxgDXgEOOAlRcXtWzpMSQTMSfL2Z639k6OZcH3VuhZANiAARwH3yLirAYsYlQuW57q-Kz_9RU17hvHz2pAADZF4XG8gyafKmzT0jAjIC5E-8rZO7k0DiaDQX7nutnN3_80mXnyrNSqskJXHt8rNRinGZjoO_LyFH1YNF1MG8CMHpGQtc",
  publicKey:
    "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEcB98i4qwGLGJULlue6vis__UVNe4bx89qQAA2ReFxvIMmnyps09IwIyAuRPvK2Tu5NA4mg0F-57rZzd__NJl58qzUqrJCVx7fKzUYpxmY6Dvy8hR9WDRdTBvAjB6RkLX",
}) as IKryptosEc;

export const MOCK_KRYPTOS_EC_SIG_ES512 = KryptosKit.from.b64({
  id: "fefd9170-918e-462f-af41-2fa2cc38e367",
  algorithm: "ES512",
  curve: "P-521",
  type: "EC",
  use: "sig",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIAYHYAaiuo4I7oVG4e9fnKZFozardouZ14yjeW_NvRFN7hvSboZkSL-fqZojUkEQg7EZ3OUkrgLi7i5-pWcXo7W_yhgYkDgYYABAHmUZan-awREfbaIXLSjn_vt5ZKODoIgVB_PivOoPVv_-q_1DL11VrdaDNauot10Q0-loR_w7-fbtjZ-akhW37sBwAKlIITptzZKCYbGPEGwVUigTzktOItv-TDIIDIgaNN2Mf6NQlTGtEA78pehV9DcSC_n2l3VCoKtAjvnS-412U3fg",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQB5lGWp_msERH22iFy0o5_77eWSjg6CIFQfz4rzqD1b__qv9Qy9dVa3WgzWrqLddENPpaEf8O_n27Y2fmpIVt-7AcACpSCE6bc2SgmGxjxBsFVIoE85LTiLb_kwyCAyIGjTdjH-jUJUxrRAO_KXoVfQ3Egv59pd1QqCrQI750vuNdlN34",
}) as IKryptosEc;

export const MOCK_KRYPTOS_EC_ENC = KryptosKit.from.b64({
  id: "ae496192-5ba9-43c0-95b7-f3d709884b9c",
  algorithm: "ECDH-ES",
  curve: "P-256",
  type: "EC",
  use: "enc",
  privateKey:
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxiQX2Mmfn9foy04OsYqV2UV3VqnEwdj4BLz7rvAjd6mhRANCAARt8n7Ft8nI79shDja5hMzUzj1-ynFEYZbxtd9qPf9K7bTwFqz-NU0mBIDiFyrPTjsmMCc2stSifEba0bF5jDu2",
  publicKey:
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbfJ-xbfJyO_bIQ42uYTM1M49fspxRGGW8bXfaj3_Su208Bas_jVNJgSA4hcqz047JjAnNrLUonxG2tGxeYw7tg",
}) as IKryptosEc;
