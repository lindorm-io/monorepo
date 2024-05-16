import { IKryptosEc, Kryptos } from "@lindorm/kryptos";

export const TEST_EC_KEY_256 = Kryptos.make({
  id: "693db144-37fe-521a-817b-2686c6306d9d",
  algorithm: "ES256",
  curve: "P-256",
  privateKey:
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsLFmeCcWuio45cJcn2_BevjL_cnKXYQPpRT9ho2AYFOhRANCAARMn5dJsxu7sOamisRIT9YFyfgvFAKxvaxMJ9RDoQD0UgWf9DqGFjLr1ZnAIqMKZlVCmZ9P01upeWDWS8fOq_4r",
  publicKey:
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAETJ-XSbMbu7DmporESE_WBcn4LxQCsb2sTCfUQ6EA9FIFn_Q6hhYy69WZwCKjCmZVQpmfT9NbqXlg1kvHzqv-Kw",
  type: "EC",
  operations: ["sign", "verify"],
  use: "sig",
}) as IKryptosEc;

export const TEST_EC_KEY_384 = Kryptos.make({
  id: "4f095e70-6694-511d-bc64-76fb6ca283f6",
  algorithm: "ES384",
  curve: "P-384",
  privateKey:
    "MIG2AgEAMBAGByqGSM49AgEGBSuBBAAiBIGeMIGbAgEBBDDJMiVlRmuKie0hIpGz9Xb6eXTD7gDCZQUuVCXTE8SQ8ptzikiqEMsSjzwiRw0JyPChZANiAASWhz3P1eM4fF9u_2wPafcQXybKKw7h1XNWFfrn4ETC06qB7Z12WWu3hrQBd5fNZGD3A51tENfU_0I_M4ZB4ZOjnzjRbulIj4M15-hALRdPgGd0u2cr0g_qbcCrUnM6eMM",
  publicKey:
    "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEloc9z9XjOHxfbv9sD2n3EF8myisO4dVzVhX65-BEwtOqge2ddllrt4a0AXeXzWRg9wOdbRDX1P9CPzOGQeGTo5840W7pSI-DNefoQC0XT4BndLtnK9IP6m3Aq1JzOnjD",
  type: "EC",
  operations: ["sign", "verify"],
  use: "sig",
}) as IKryptosEc;

export const TEST_EC_KEY_512 = Kryptos.make({
  id: "9e568fdb-ed87-5a24-800a-44e1a143d5da",
  algorithm: "ES512",
  curve: "P-521",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
  type: "EC",
  operations: ["sign", "verify"],
  use: "sig",
}) as IKryptosEc;
