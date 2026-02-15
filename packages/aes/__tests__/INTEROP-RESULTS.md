# AES Interop Test Results

## Summary

All 59 interop tests pass. Zero divergences found between `@lindorm/aes`,
`@noble/ciphers`, and `jose`.

| Suite         | Tests  | Pass   | Fail  | Skip  |
| ------------- | ------ | ------ | ----- | ----- |
| noble-ciphers | 21     | 21     | 0     | 0     |
| jose-jwe      | 38     | 38     | 0     | 0     |
| **Total**     | **59** | **59** | **0** | **0** |

## noble/ciphers Primitive Tests

| Primitive         | Key Sizes     | Direction                      | Result |
| ----------------- | ------------- | ------------------------------ | ------ |
| AES-GCM           | 128, 192, 256 | ours → noble                   | PASS   |
| AES-GCM           | 128, 192, 256 | noble → ours                   | PASS   |
| AES-GCM           | 128, 192, 256 | byte-identical (pinned IV)     | PASS   |
| AES-KW (RFC 3394) | 128, 192, 256 | ours → noble                   | PASS   |
| AES-KW (RFC 3394) | 128, 192, 256 | noble → ours                   | PASS   |
| AES-KW (RFC 3394) | 128, 192, 256 | byte-identical (deterministic) | PASS   |
| AES-CBC (raw)     | 128, 192, 256 | byte-identical (PKCS7)         | PASS   |

## jose JWE Tests

| Algorithm              | Encryption                                  | Direction   | Result |
| ---------------------- | ------------------------------------------- | ----------- | ------ |
| dir                    | A128GCM, A192GCM, A256GCM                   | ours → jose | PASS   |
| dir                    | A128GCM, A192GCM, A256GCM                   | jose → ours | PASS   |
| dir                    | A128CBC-HS256, A192CBC-HS384, A256CBC-HS512 | ours → jose | PASS   |
| dir                    | A128CBC-HS256, A192CBC-HS384, A256CBC-HS512 | jose → ours | PASS   |
| A128KW, A192KW, A256KW | A128GCM, A256GCM                            | ours → jose | PASS   |
| A128KW, A192KW, A256KW | A128GCM, A256GCM                            | jose → ours | PASS   |
| A128KW, A192KW, A256KW | A128CBC-HS256, A192CBC-HS384, A256CBC-HS512 | ours → jose | PASS   |
| A128KW, A192KW, A256KW | A128CBC-HS256, A192CBC-HS384, A256CBC-HS512 | jose → ours | PASS   |
| A128GCMKW, A256GCMKW   | A256GCM                                     | ours → jose | PASS   |
| A128GCMKW, A256GCMKW   | A256GCM                                     | jose → ours | PASS   |
| Pinned deterministic   | A256GCM (byte-identical)                    | comparison  | PASS   |
| Pinned deterministic   | A256GCM (round-trip)                        | comparison  | PASS   |
| Pinned deterministic   | A128CBC-HS256 (byte-identical)              | comparison  | PASS   |
| Pinned deterministic   | A128CBC-HS256 (round-trip)                  | comparison  | PASS   |

## Validated RFC Compliance

- **RFC 7516** (JWE): AAD computation, flattened serialization format
- **RFC 7518** (JWA): AES-GCM, AES-CBC-HMAC-SHA2, AES Key Wrap, AES-GCM Key Wrap
- **RFC 3394**: AES Key Wrap (deterministic, AIV verification)

## Notes

- GCMKW "ours → jose" direction uses a two-pass approach due to the circular
  dependency between key-wrap params and JWE AAD. Content is re-encrypted with
  the correct AAD after extracting key-wrap params from the first pass.
- jose v6 rejects `setContentEncryptionKey()` with `alg: "dir"`, so deterministic
  pinned tests use A\*KW algorithms instead. Content encryption is identical
  regardless of key management algorithm.
- `@noble/ciphers` GCM returns ciphertext with auth tag appended (last 16 bytes).
  Tests correctly split/concatenate when converting between formats.

## Environment

- Node.js >= 24.4.0
- `@noble/ciphers` ^1.2.1
- `jose` ^6.1.3
