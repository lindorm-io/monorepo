Feature: AES content encryption

  Background:
    Given an oct key with algorithm "A128KW" and encryption "A128GCM"

  Rule: a round trip preserves the content

    Example: default mode
      When I encrypt "hello world"
      Then decrypting returns "hello world"

    Scenario Outline: every content encryption round-trips
      Given an oct key with algorithm "A128KW" and encryption "<encryption>"
      When I encrypt "payload"
      Then decrypting returns "payload"

      Examples:
        | encryption    |
        | A128GCM       |
        | A256GCM       |
        | A256CBC-HS512 |

  Rule: every content type survives a round trip

    Scenario Outline: <type> content round-trips intact
      When I encrypt the JSON value <value>
      Then decrypting returns the same value

      Examples:
        | type         | value                                  |
        | string       | "hello"                                |
        | object       | {"key":"value","nested":{"deep":true}} |
        | array        | [1,"two",{"three":3}]                  |
        | integer      | 42                                     |
        | float        | 3.14                                   |
        | empty string | ""                                     |

    Example: binary content round-trips intact
      When I encrypt the bytes "binary data"
      Then decrypting returns the same value

  Rule: record mode binds the caller-supplied AAD

    Scenario Outline: under <encryption> the bound AAD must be re-supplied
      Given an oct key with algorithm "A128KW" and encryption "<encryption>"
      When I encrypt "secret" in record mode with aad "tenant-1"
      Then decrypting with aad "tenant-1" returns "secret"
      And verifying "secret" with aad "tenant-1" returns true
      But decrypting with aad "tenant-2" is rejected
      And decrypting without an aad is rejected

      Examples:
        | encryption    |
        | A128GCM       |
        | A128CBC-HS256 |

    Example: record mode round-trips without an AAD
      When I encrypt "secret" in record mode
      Then decrypting returns "secret"

  Rule: the cbor and serialised headers are authenticated

    Scenario Outline: tampering with the <mode> cipher's header is rejected
      When I encrypt "secret" in <mode> mode
      And the cipher's header is tampered with
      Then decrypting is rejected

      Examples:
        | mode       |
        | cbor       |
        | serialised |

  Rule: verify and assert judge a cipher against the expected content

    Scenario Outline: every output mode verifies its own cipher
      When I encrypt "sealed" in <mode> mode
      Then verifying "sealed" returns true
      And verifying "tampered" returns false

      Examples:
        | mode       |
        | cbor       |
        | record     |
        | serialised |

    Example: verifying the wrong content returns false
      When I encrypt "sealed"
      Then verifying "wrong" returns false

    Example: a corrupted cipher fails verification
      When I encrypt "sealed" in record mode
      And the ciphertext is tampered with
      Then verifying "sealed" returns false

    Example: assert accepts the matching content
      When I encrypt "sealed" in cbor mode
      Then asserting "sealed" passes

    Example: assert rejects the wrong content
      When I encrypt "sealed" in cbor mode
      Then asserting "tampered" is rejected

  Rule: ECDH-ES key agreement carries the party information

    Scenario Outline: apu and apv round-trip in <mode> mode
      Given an EC key for ECDH-ES key agreement
      When I encrypt "agreement" in <mode> mode with apu "Alice" and apv "Bob"
      Then decrypting returns "agreement"

      Examples:
        | mode       |
        | cbor       |
        | record     |
        | serialised |

    Example: the serialised cipher carries apu and apv for the recipient
      Given an EC key for ECDH-ES key agreement
      When I encrypt "agreement" in serialised mode with apu "Alice" and apv "Bob"
      Then the parsed cipher carries apu "Alice" and apv "Bob"
      And decrypting returns "agreement"

    Example: the cbor cipher carries apu and apv for the recipient
      Given an OKP key for ECDH-ES key agreement
      When I encrypt "agreement" in cbor mode with apu "Alice" and apv "Bob"
      Then the parsed cipher carries apu "Alice" and apv "Bob"
      And decrypting returns "agreement"

    Example: without apu and apv the cipher carries none
      Given an EC key for ECDH-ES key agreement
      When I encrypt "agreement" in serialised mode
      Then the parsed cipher carries no apu and no apv
      And decrypting returns "agreement"

  Rule: the key selects the content encryption

    Scenario Outline: a key declaring "<declared>" beats the kit fallback
      Given an oct key with algorithm "<algorithm>" and encryption "<declared>"
      And the kit falls back to encryption "A256GCM"
      When I encrypt "payload"
      Then the cipher declares encryption "<declared>"
      And decrypting returns "payload"

      Examples:
        | algorithm | declared      |
        | dir       | A192CBC-HS384 |
        | A256KW    | A128GCM       |

    Example: a key that declares no encryption takes the kit fallback
      Given an oct key that declares no encryption
      And the kit falls back to encryption "A128CBC-HS256"
      When I encrypt "payload"
      Then the cipher declares encryption "A128CBC-HS256"
      And decrypting returns "payload"

    Example: without a fallback the kit defaults to A256GCM
      Given an oct key that declares no encryption
      When I encrypt "payload"
      Then the cipher declares encryption "A256GCM"
      And decrypting returns "payload"

  Rule: AES-CCM encrypts with a direct key

    Scenario Outline: <encryption> round-trips through every format
      Given an oct key with algorithm "dir" and encryption "<encryption>"
      When I encrypt "payload" in cbor mode
      Then decrypting returns "payload"
      When I encrypt "payload" in serialised mode
      Then decrypting returns "payload"
      When I encrypt "payload" in record mode
      Then decrypting returns "payload"
      And the record carries a <nonce>-byte nonce and a <tag>-byte tag

      Examples:
        | encryption         | nonce | tag |
        | AES-CCM-16-64-128  | 13    | 8   |
        | AES-CCM-16-64-256  | 13    | 8   |
        | AES-CCM-64-64-128  | 7     | 8   |
        | AES-CCM-64-64-256  | 7     | 8   |
        | AES-CCM-16-128-128 | 13    | 16  |
        | AES-CCM-16-128-256 | 13    | 16  |
        | AES-CCM-64-128-128 | 7     | 16  |
        | AES-CCM-64-128-256 | 7     | 16  |

    Example: a tampered ciphertext is rejected
      Given an oct key with algorithm "dir" and encryption "AES-CCM-16-128-128"
      When I encrypt "secret" in record mode
      And the ciphertext is tampered with
      Then decrypting is rejected

  Rule: raw bytes seal and unseal without a header

    Example: sealed bytes round-trip with a caller AAD
      Given an oct key with algorithm "dir" and encryption "AES-CCM-16-128-128"
      When I seal the bytes "cose-payload" with aad "cose-enc-structure"
      Then unsealing as "AES-CCM-16-128-128" with aad "cose-enc-structure" returns the bytes

    Example: a fixed nonce yields identical ciphertext bytes
      Given an oct key with algorithm "dir" and encryption "AES-CCM-16-128-256"
      When I seal the bytes "deterministic" twice with aad "aad" and a fixed 13-byte nonce
      Then both seals carry identical ciphertext and tag

    Example: unsealing with a different AAD is rejected
      Given an oct key with algorithm "dir" and encryption "AES-CCM-64-64-128"
      When I seal the bytes "payload" with aad "right"
      Then unsealing as "AES-CCM-64-64-128" with aad "wrong" is rejected

    Example: sealing requires a direct key
      Given an oct key with algorithm "A256KW" and encryption "A256GCM"
      Then sealing bytes is rejected

    Example: the seal follows the key's declared encryption
      Given an oct key with algorithm "dir" and encryption "A192CBC-HS384"
      And the kit falls back to encryption "A256GCM"
      When I seal the bytes "payload"
      Then the seal carries a 24-byte tag
      And unsealing as "A192CBC-HS384" returns the bytes

    Example: unsealing follows the wire's encryption, not the key's
      Given an oct key with algorithm "dir" and encryption "A128CBC-HS256"
      When a peer with the same secret seals "from a peer" under "A256GCM"
      Then unsealing as "A256GCM" returns the bytes

  Rule: the content type is derived from the value

    Scenario Outline: <type> content is typed as <contentType>
      Then the content type of the JSON value <value> is "<contentType>"

      Examples:
        | type   | value           | contentType      |
        | string | "hello"         | text/plain       |
        | object | {"key":"value"} | application/json |
        | array  | [1,2,3]         | application/json |
        | number | 42              | application/json |

    Example: bytes are typed as application/octet-stream
      Then the content type of the bytes "data" is "application/octet-stream"

  Rule: a cipher is recognisable and parses into its record

    Example: an encrypted string is recognised as an AES string
      When I encrypt "content"
      Then the cipher is recognised as an AES string

    Example: a plain string is not recognised as an AES string
      Then "regular string" is not recognised as an AES string

    Example: parsing an already-parsed record returns it unchanged
      When I encrypt "content" in record mode
      Then parsing the record returns it unchanged

  Rule: only the known output modes encrypt

    Example: encrypting in an unknown mode is rejected
      Then encrypting in sideways mode is rejected as an unknown mode
