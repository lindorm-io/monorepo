Feature: Kryptos key

  Rule: a key exposes its metadata

    Scenario Outline: <algorithm> identifies itself as type <type>
      Given a generated "<algorithm>" key
      Then the key's id is a 16-character key id
      And the key has type "<type>" and use "<use>"
      And the key's algorithm is "<algorithm>"
      And the key's curve is <curve>
      And the key's encryption is <encryption>
      And the key's algorithm class is "<algClass>"
      And the key prints as "Kryptos<<type>:<algorithm>:" followed by its id

      Examples:
        | algorithm | type | use | curve     | encryption | algClass   |
        | ML-DSA-44 | AKP  | sig | null      | null       | asymmetric |
        | ES256     | EC   | sig | "P-256"   | null       | asymmetric |
        | ECDH-ES   | OKP  | enc | "X25519"  | "A256GCM"  | asymmetric |
        | HS256     | oct  | sig | null      | null       | symmetric  |
        | A256KW    | oct  | enc | null      | "A256GCM"  | symmetric  |
        | EdDSA     | OKP  | sig | "Ed25519" | null       | asymmetric |
        | RS256     | RSA  | sig | null      | null       | asymmetric |

    Scenario Outline: <modulus>-bit RSA keys report their modulus
      Given a generated "RS256" key with a <modulus>-bit modulus
      Then the key's modulus is <modulus>

      Examples:
        | modulus |
        | 1024    |
        | 2048    |
        | 3072    |
        | 4096    |

    Scenario Outline: <type> keys carry no modulus
      Given a generated "<algorithm>" key
      Then the key's modulus is null

      Examples:
        | type | algorithm |
        | AKP  | ML-DSA-44 |
        | EC   | ES256     |
        | oct  | HS256     |
        | OKP  | EdDSA     |

    Example: a key reports the timestamps it was minted with
      When I generate an "ES256" key with the options
        | createdAt | 2026-01-01T00:00:00.000Z |
        | notBefore | 2026-01-02T00:00:00.000Z |
        | expiresAt | 2036-01-02T00:00:00.000Z |
      Then the key was created at "2026-01-01T00:00:00.000Z"
      And the key is valid from "2026-01-02T00:00:00.000Z"
      And the key expires at "2036-01-02T00:00:00.000Z"

    Example: descriptors that were never set read null
      Given a generated "ES256" key
      Then the key's issuer, jwksUri, ownerId and purpose are all null

    Scenario Outline: <algorithm> with both halves can <operations>
      Given a generated "<algorithm>" key
      Then the key's operations are <operations>

      Examples:
        | algorithm          | operations                                  |
        | ML-DSA-44          | ["sign","verify"]                           |
        | ES256              | ["sign","verify"]                           |
        | EdDSA              | ["sign","verify"]                           |
        | HS256              | ["sign","verify"]                           |
        | RS256              | ["sign","verify"]                           |
        | A256KW             | ["wrapKey","unwrapKey"]                     |
        | A128GCMKW          | ["wrapKey","unwrapKey"]                     |
        | dir                | ["encrypt","decrypt"]                       |
        | PBES2-HS256+A128KW | ["deriveKey"]                               |
        | ECDH-ES            | ["deriveKey","deriveBits"]                  |
        | ECDH-ES+A256KW     | ["deriveKey","deriveBits"]                  |
        | RSA-OAEP-256       | ["encrypt","decrypt","wrapKey","unwrapKey"] |

    Scenario Outline: <algorithm> with only its public half can <operations>
      Given a generated "<algorithm>" key
      When I import its public JWK
      Then the imported key's operations are <operations>

      Examples:
        | algorithm    | operations                 |
        | ML-DSA-44    | ["verify"]                 |
        | ES256        | ["verify"]                 |
        | EdDSA        | ["verify"]                 |
        | RS256        | ["verify"]                 |
        | ECDH-ES      | ["deriveKey","deriveBits"] |
        | RSA-OAEP-256 | ["encrypt","wrapKey"]      |

  Rule: a key knows where it is in its lifetime

    Example: a key is pending until its first valid instant
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T12:00:00.001Z |
        | expiresAt | 2026-08-05T13:00:00.000Z |
      Then the key is pending

    Example: a key is active at the exact instant it becomes valid
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T12:00:00.000Z |
        | expiresAt | 2026-08-05T13:00:00.000Z |
      Then the key is active

    Example: a key is still active one millisecond before it expires
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T11:00:00.000Z |
        | expiresAt | 2026-08-05T12:00:00.001Z |
      Then the key is active

    Example: a key is expired at the exact instant it expires
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T11:00:00.000Z |
        | expiresAt | 2026-08-05T12:00:00.000Z |
      Then the key is expired

    Example: a window that collapses onto now is expired, never active
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T12:00:00.000Z |
        | expiresAt | 2026-08-05T12:00:00.000Z |
      Then the key is expired

    Example: a key counts down the seconds until it expires
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T11:00:00.000Z |
        | expiresAt | 2026-08-05T12:01:30.000Z |
      Then the key expires in 90 seconds

    Example: an expired key has no seconds left
      Given the clock reads "2026-08-05T12:00:00.000Z"
      When I generate an "ES256" key with the options
        | notBefore | 2026-08-05T11:00:00.000Z |
        | expiresAt | 2026-08-05T11:59:59.000Z |
      Then the key expires in 0 seconds

  Rule: every export format round-trips

    Scenario Outline: <type>'s <format> export re-imports unchanged
      Given a generated "<algorithm>" key
      When I re-import the key from its <format> export
      Then the imported key matches the key's id, thumbprint and material

      Examples:
        | type | algorithm | format |
        | AKP  | ML-DSA-44 | b64    |
        | AKP  | ML-DSA-44 | der    |
        | AKP  | ML-DSA-44 | jwk    |
        | AKP  | ML-DSA-44 | pem    |
        | EC   | ES256     | b64    |
        | EC   | ES256     | der    |
        | EC   | ES256     | jwk    |
        | EC   | ES256     | pem    |
        | oct  | HS256     | b64    |
        | oct  | HS256     | der    |
        | oct  | HS256     | jwk    |
        | oct  | HS256     | pem    |
        | OKP  | EdDSA     | b64    |
        | OKP  | EdDSA     | der    |
        | OKP  | EdDSA     | jwk    |
        | OKP  | EdDSA     | pem    |
        | RSA  | RS256     | b64    |
        | RSA  | RS256     | der    |
        | RSA  | RS256     | jwk    |
        | RSA  | RS256     | pem    |

    Example: the PEM export of a certified key carries its chain
      Given a root CA key
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the PEM export carries the leaf certificate and the whole chain

    Example: the PEM export of an uncertified key carries no certificate
      Given a generated "ES256" key
      Then the PEM export carries no certificate

    Example: an unknown export format is refused
      Given a generated "ES256" key
      Then exporting the key as "x509" is refused as "unsupported_export_format"

  Rule: a JWK never leaks what the mode forbids

    Scenario Outline: <type>'s public JWK carries <public> and never <private>
      Given a generated "<algorithm>" key
      Then the key's public JWK carries the members <public>
      And the key's public JWK carries none of the members <private>
      And the key's public JWK carries no private member and no publish flag
      And the key's private JWK carries the members <private> and the publish flag

      Examples:
        | type | algorithm | public    | private                       |
        | AKP  | ML-DSA-44 | ["pub"]   | ["priv"]                      |
        | EC   | ES256     | ["x","y"] | ["d"]                         |
        | OKP  | EdDSA     | ["x"]     | ["d"]                         |
        | RSA  | RS256     | ["n","e"] | ["d","p","q","dp","dq","qi"] |

    Example: a symmetric key has no public JWK
      Given a generated "HS256" key
      Then asking the key for its public JWK is refused as "no_public_jwk"
      And asking the key for its default JWK is refused as "no_public_jwk"
      And the key's private JWK carries the members ["k"] and the publish flag

    Scenario Outline: <algorithm> never emits key_ops in its private JWK
      Given a generated "<algorithm>" key
      Then the key's private JWK carries no key_ops

      Examples:
        | algorithm      |
        | ML-DSA-44      |
        | ES256          |
        | EdDSA          |
        | HS256          |
        | RS256          |
        | A256KW         |
        | ECDH-ES+A256KW |
        | RSA-OAEP-256   |

    Scenario Outline: <algorithm> never emits key_ops in its public JWK
      Given a generated "<algorithm>" key
      Then the key's public JWK carries no key_ops

      Examples:
        | algorithm      |
        | ML-DSA-44      |
        | ES256          |
        | EdDSA          |
        | RS256          |
        | ECDH-ES+A256KW |
        | RSA-OAEP-256   |

    Example: the kid of every JWK is the key's id
      Given a generated "ES256" key
      Then both JWK modes carry the key's id as kid

    Example: a certified key's JWK carries its chain and digests
      Given a root CA key
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the key's public JWK carries the 2-certificate chain and its digests

    Example: an uncertified key's JWK carries no certificate members
      Given a generated "ES256" key
      Then the key's public JWK carries none of the members ["x5c","x5t","x5t#S256"]

  Rule: a key serialises for storage and for logs

    Example: the database row carries the material, the chain and the attributes
      Given a root CA key
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the database row carries the key's base64 material, certificate chain and attributes
      When I restore the key from its database row
      Then the restored key matches the key's database row
      And the restored key carries the same certificate chain as the key

    Scenario Outline: <type>'s JSON view carries no key material
      Given a generated "<algorithm>" key
      Then the JSON view carries no key material

      Examples:
        | type | algorithm |
        | EC   | ES256     |
        | oct  | HS256     |
        | RSA  | RS256     |

    Example: the JSON view reports the computed state of the key
      Given a root CA key
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the JSON view reports
        | isActive       | true              |
        | isExpired      | false             |
        | isPending      | false             |
        | hasPrivateKey  | true              |
        | hasPublicKey   | true              |
        | hasCertificate | true              |
        | algClass       | "asymmetric"      |
        | operations     | ["sign","verify"] |
      And the JSON view's thumbprint and certificate thumbprint are the key's

    Example: the env string is CBOR unless JSON is asked for
      Given a generated "ES256" key
      When I serialise the key as an env string
      Then the env string payload is a CBOR map
      When I serialise the key as a "json" env string
      Then the env string payload is a JSON object

    Scenario Outline: <format> env string from the key re-imports it
      Given a generated "ES256" key
      When I serialise the key as a "<format>" env string
      And I import the env string
      Then the imported key matches the key's id, thumbprint and publish flag

      Examples:
        | format |
        | cbor   |
        | json   |

    Example: an unknown env format is refused
      Given a generated "ES256" key
      Then serialising the key in the "xml" env format is refused as "unsupported_env_format"

  Rule: a thumbprint identifies the key material

    Scenario Outline: <type>'s public half has the same thumbprint as the whole key
      Given a generated "<algorithm>" key
      When I import its public JWK
      Then the imported key has the same thumbprint as the key

      Examples:
        | type | algorithm |
        | AKP  | ML-DSA-44 |
        | EC   | ES256     |
        | OKP  | EdDSA     |
        | RSA  | RS256     |

    Scenario Outline: <algorithm> generated twice yields different thumbprints
      Given a generated "<algorithm>" key
      And another generated "<algorithm>" key
      Then both keys have different thumbprints

      Examples:
        | algorithm |
        | ML-DSA-44 |
        | ES256     |
        | HS256     |
        | EdDSA     |
        | RS256     |

    Scenario Outline: <type>'s thumbprint is the RFC 7638 digest of its members <members>
      Given a generated "<algorithm>" key
      Then the key's thumbprint is the base64url SHA-256 of its JWK members <members>

      Examples:
        | type | algorithm | members               |
        | EC   | ES256     | ["crv","kty","x","y"] |
        | RSA  | RS256     | ["e","kty","n"]       |
        | oct  | HS256     | ["k","kty"]           |

  Rule: a disposed key gives nothing away

    Example: a disposed key refuses every door to its material
      Given a generated "ES256" key
      When I dispose of the key
      Then reading the key's thumbprint is refused as "key_disposed"
      And exporting the key as "jwk" is refused as "key_disposed"
      And asking the key for its private JWK is refused as "key_disposed"
      And asking the key for its database row is refused as "key_disposed"
      And serialising the key as an env string is refused as "key_disposed"
      And verifying the certificate against the fixture root is refused as "key_disposed"

    Example: a key disposed by leaving a using block refuses alike
      Given a generated "ES256" key
      When the key leaves a using block
      Then reading the key's thumbprint is refused as "key_disposed"
      And exporting the key as "pem" is refused as "key_disposed"

    Example: disposing twice is harmless
      Given a generated "ES256" key
      When I dispose of the key
      And I dispose of the key
      Then reading the key's thumbprint is refused as "key_disposed"

    Example: a disposed key still answers for its attributes
      Given a generated "ES256" key
      When I dispose of the key
      Then the key has type "EC" and use "sig"
      And the key's algorithm is "ES256"
      And the key's curve is "P-256"
      And the key's algorithm class is "asymmetric"
      And the key's id is a 16-character key id
      And the key prints as "Kryptos<EC:ES256:" followed by its id

  Rule: a key carries and verifies its certificate chain

    Example: every certificate format states the same chain and digests, leaf first
      Given the fixture leaf key with its full certificate chain
      Then the certificate chain has 3 certificates
      And the b64, der, jwk and pem certificate formats state the same chain and digests
      And the certificate digests are those of the leaf
      And the certificate thumbprint on the key is the chain's SHA-256 digest

    Example: a key without a certificate states none in every format
      Given a generated "ES256" key
      Then every certificate format states no certificate
      And the certificate thumbprint is absent

    Example: an unknown certificate format is refused
      Given the fixture leaf key with its full certificate chain
      Then asking for the certificate in "x509" format is refused as "unsupported_certificate_format"

    Example: an unknown certificate format is refused without a chain too
      Given a generated "ES256" key
      Then asking for the certificate in "x509" format is refused as "unsupported_certificate_format"

    Example: the chain is parsed by index, leaf first
      Given the fixture leaf key with its full certificate chain
      Then the certificate at index 0 has subject "lindorm-test-leaf"
      And the certificate at index 1 has subject "lindorm-test-intermediate"
      And the certificate at index 2 has subject "lindorm-test-root"
      And the parsed leaf is the certificate at index 0

    Scenario Outline: <index> is an index outside the chain
      Given the fixture leaf key with its full certificate chain
      Then the certificate at index <index> is absent

      Examples:
        | index |
        | 3     |
        | -1    |
        | 1.5   |

    Example: a key without a certificate has nothing to parse
      Given a generated "ES256" key
      Then the certificate at index 0 is absent

    Example: a chain verifies against its root
      Given the fixture leaf key with its full certificate chain
      Then the certificate verifies against the fixture root

    Example: a chain is refused against a foreign root
      Given the fixture leaf key with its full certificate chain
      Then verifying the certificate against the alternative fixture root is refused as "trust_anchor_mismatch"

    Example: a key without a certificate has nothing to verify
      Given a generated "ES256" key
      Then verifying the certificate against the fixture root is refused as "missing_certificate"

    Example: an expired certificate is refused
      Given the fixture expired key with its certificate chain
      Then verifying the certificate against the fixture root is refused as "certificate_outside_validity_window"

    Example: a PEM import whose certificate does not match the key is refused
      Given a generated "ES256" key
      Then importing its PEM export carrying the fixture leaf certificate is refused as "certificate_public_key_mismatch"

    Example: a JWK import whose certificate does not match the key is refused
      Given a generated "ES256" key
      Then importing its public JWK carrying the fixture leaf certificate is refused as "certificate_public_key_mismatch"

  Rule: a key cannot exist without its material

    Example: a key needs at least one half
      Then constructing an EC key without any key material is refused as "missing_key_material"

    Example: a certificate chain needs a public half
      Then constructing a symmetric key with a certificate chain is refused as "missing_public_key"
