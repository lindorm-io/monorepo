Feature: Kryptos key facade

  Rule: every JOSE algorithm mints a key of its type

    Scenario Outline: <algorithm> mints an asymmetric <type> signing key
      Given the algorithm "<algorithm>"
      When I generate a signing key of type "<type>" with it
      Then the key has type "<type>" and use "sig"
      And the key's algorithm is "<algorithm>"
      And the key's curve is <curve>
      And the key carries both a private and a public half

      Examples:
        | type | algorithm | curve     |
        | AKP  | ML-DSA-44 | null      |
        | AKP  | ML-DSA-65 | null      |
        | AKP  | ML-DSA-87 | null      |
        | EC   | ES256     | "P-256"   |
        | EC   | ES384     | "P-384"   |
        | EC   | ES512     | "P-521"   |
        | OKP  | EdDSA     | "Ed25519" |
        | RSA  | RS256     | null      |
        | RSA  | RS384     | null      |
        | RSA  | RS512     | null      |
        | RSA  | PS256     | null      |
        | RSA  | PS384     | null      |
        | RSA  | PS512     | null      |

    Scenario Outline: <algorithm> mints a symmetric signing key
      Given the algorithm "<algorithm>"
      When I generate a signing key of type "oct" with it
      Then the key has type "oct" and use "sig"
      And the key's algorithm is "<algorithm>"
      And the key's curve is null
      And the key carries only a private half

      Examples:
        | algorithm |
        | HS256     |
        | HS384     |
        | HS512     |

    Scenario Outline: <algorithm> mints an asymmetric <type> encryption key
      Given the algorithm "<algorithm>"
      When I generate an encryption key of type "<type>" with it
      Then the key has type "<type>" and use "enc"
      And the key's algorithm is "<algorithm>"
      And the key's curve is <curve>
      And the key carries both a private and a public half

      Examples:
        | type | algorithm         | curve    |
        | EC   | ECDH-ES           | "P-256"  |
        | EC   | ECDH-ES+A128KW    | "P-256"  |
        | EC   | ECDH-ES+A192KW    | "P-384"  |
        | EC   | ECDH-ES+A256KW    | "P-521"  |
        | EC   | ECDH-ES+A128GCMKW | "P-256"  |
        | EC   | ECDH-ES+A192GCMKW | "P-384"  |
        | EC   | ECDH-ES+A256GCMKW | "P-521"  |
        | OKP  | ECDH-ES           | "X25519" |
        | OKP  | ECDH-ES+A128KW    | "X25519" |
        | OKP  | ECDH-ES+A192KW    | "X448"   |
        | OKP  | ECDH-ES+A256KW    | "X448"   |
        | OKP  | ECDH-ES+A128GCMKW | "X25519" |
        | OKP  | ECDH-ES+A192GCMKW | "X448"   |
        | OKP  | ECDH-ES+A256GCMKW | "X448"   |
        | RSA  | RSA-OAEP          | null     |
        | RSA  | RSA-OAEP-256      | null     |
        | RSA  | RSA-OAEP-384      | null     |
        | RSA  | RSA-OAEP-512      | null     |

    Scenario Outline: <algorithm> mints a symmetric encryption key
      Given the algorithm "<algorithm>"
      When I generate an encryption key of type "oct" with it
      Then the key has type "oct" and use "enc"
      And the key's algorithm is "<algorithm>"
      And the key's curve is null
      And the key carries only a private half

      Examples:
        | algorithm          |
        | dir                |
        | A128KW             |
        | A192KW             |
        | A256KW             |
        | A128GCMKW          |
        | A192GCMKW          |
        | A256GCMKW          |
        | PBES2-HS256+A128KW |
        | PBES2-HS384+A192KW |
        | PBES2-HS512+A256KW |

    Scenario Outline: <curve> is honoured when an OKP key asks for it
      Given the algorithm "<algorithm>" on curve "<curve>"
      When I generate a "<use>" key of type "OKP" with it
      Then the key's curve is "<curve>"
      And the key's algorithm is "<algorithm>"

      Examples:
        | use | algorithm      | curve   |
        | sig | EdDSA          | Ed448   |
        | enc | ECDH-ES        | X448    |
        | enc | ECDH-ES+A256KW | X25519  |

    Scenario Outline: <algorithm> resolves to type <type> automatically
      Given the algorithm "<algorithm>"
      When I generate a key automatically for it
      Then the key has type "<type>" and use "<use>"
      And the key's curve is <curve>
      And the key's encryption is <encryption>
      And the key type resolved for "<algorithm>" is "<type>"

      Examples:
        | algorithm          | type | use | curve     | encryption |
        | ML-DSA-44          | AKP  | sig | null      | null       |
        | ML-DSA-65          | AKP  | sig | null      | null       |
        | ML-DSA-87          | AKP  | sig | null      | null       |
        | ES256              | EC   | sig | "P-256"   | null       |
        | ES384              | EC   | sig | "P-384"   | null       |
        | ES512              | EC   | sig | "P-521"   | null       |
        | EdDSA              | OKP  | sig | "Ed25519" | null       |
        | ECDH-ES            | OKP  | enc | "X25519"  | "A256GCM"  |
        | ECDH-ES+A128KW     | OKP  | enc | "X25519"  | "A256GCM"  |
        | ECDH-ES+A128GCMKW  | OKP  | enc | "X25519"  | "A256GCM"  |
        | ECDH-ES+A192KW     | OKP  | enc | "X448"    | "A256GCM"  |
        | ECDH-ES+A192GCMKW  | OKP  | enc | "X448"    | "A256GCM"  |
        | ECDH-ES+A256KW     | OKP  | enc | "X448"    | "A256GCM"  |
        | ECDH-ES+A256GCMKW  | OKP  | enc | "X448"    | "A256GCM"  |
        | HS256              | oct  | sig | null      | null       |
        | HS384              | oct  | sig | null      | null       |
        | HS512              | oct  | sig | null      | null       |
        | dir                | oct  | enc | null      | "A256GCM"  |
        | A128KW             | oct  | enc | null      | "A256GCM"  |
        | A192KW             | oct  | enc | null      | "A256GCM"  |
        | A256KW             | oct  | enc | null      | "A256GCM"  |
        | A128GCMKW          | oct  | enc | null      | "A256GCM"  |
        | A192GCMKW          | oct  | enc | null      | "A256GCM"  |
        | A256GCMKW          | oct  | enc | null      | "A256GCM"  |
        | PBES2-HS256+A128KW | oct  | enc | null      | "A256GCM"  |
        | PBES2-HS384+A192KW | oct  | enc | null      | "A256GCM"  |
        | PBES2-HS512+A256KW | oct  | enc | null      | "A256GCM"  |
        | RS256              | RSA  | sig | null      | null       |
        | RS384              | RSA  | sig | null      | null       |
        | RS512              | RSA  | sig | null      | null       |
        | PS256              | RSA  | sig | null      | null       |
        | PS384              | RSA  | sig | null      | null       |
        | PS512              | RSA  | sig | null      | null       |
        | RSA-OAEP           | RSA  | enc | null      | "A256GCM"  |
        | RSA-OAEP-256       | RSA  | enc | null      | "A256GCM"  |
        | RSA-OAEP-384       | RSA  | enc | null      | "A256GCM"  |
        | RSA-OAEP-512       | RSA  | enc | null      | "A256GCM"  |

    Scenario Outline: <algorithm> mints the same <type> key asynchronously
      Given the algorithm "<algorithm>"
      When I asynchronously generate a signing key of type "<type>" with it
      Then the key has type "<type>" and use "sig"
      And the key's algorithm is "<algorithm>"
      And the key's curve is <curve>

      Examples:
        | type | algorithm | curve     |
        | AKP  | ML-DSA-44 | null      |
        | EC   | ES256     | "P-256"   |
        | oct  | HS256     | null      |
        | OKP  | EdDSA     | "Ed25519" |
        | RSA  | RS256     | null      |

    Scenario Outline: <algorithm> mints the same <type> encryption key asynchronously
      Given the algorithm "<algorithm>"
      When I asynchronously generate an encryption key of type "<type>" with it
      Then the key has type "<type>" and use "enc"
      And the key's algorithm is "<algorithm>"
      And the key's curve is <curve>
      And the key's encryption is "A256GCM"

      Examples:
        | type | algorithm    | curve    |
        | EC   | ECDH-ES      | "P-256"  |
        | oct  | A256KW       | null     |
        | OKP  | ECDH-ES      | "X25519" |
        | RSA  | RSA-OAEP-256 | null     |

    Example: automatic generation resolves the type asynchronously too
      Given the algorithm "ECDH-ES"
      When I asynchronously generate a key automatically for it
      Then the key has type "OKP" and use "enc"
      And the key's curve is "X25519"
      And the key's encryption is "A256GCM"

  Rule: generation applies documented defaults

    Example: a key expires 25 years after it becomes valid
      Given the generation options
        | notBefore | 2026-01-01T00:00:00.000Z |
      When I generate an "ES256" key with those options
      Then the key expires at "2051-01-01T00:00:00.000Z"

    Example: an encryption key without a content encryption takes A256GCM
      Given the algorithm "A256KW"
      When I generate an encryption key of type "oct" with it
      Then the key's encryption is "A256GCM"

    Example: a signing key carries no content encryption
      Given the algorithm "ES256"
      When I generate a signing key of type "EC" with it
      Then the key's encryption is null

    Example: every explicit option is carried on the key
      Given the generation options
        | id         | key_explicit0000          |
        | createdAt  | 2025-12-31T00:00:00.000Z  |
        | notBefore  | 2026-01-01T00:00:00.000Z  |
        | expiresAt  | 2036-01-01T00:00:00.000Z  |
        | issuer     | https://issuer.test/      |
        | jwksUri    | https://issuer.test/jwks  |
        | ownerId    | owner-1                   |
        | purpose    | kek                       |
        | encryption | A128GCM                   |
        | publish    | true                      |
      When I generate an "A256KW" key with those options
      Then the key carries those options

  Rule: a key refuses an algorithm it cannot carry

    Example: an EC key refuses an algorithm without an EC curve
      Given the algorithm "RS256"
      When I try to generate an EC signing key with it
      Then it is refused as "unsupported_ec_curve"

    Example: an AKP key refuses an algorithm that is not ML-DSA
      Given the algorithm "ES256"
      When I try to generate an AKP signing key with it
      Then it is refused as "unsupported_akp_algorithm"

    Example: automatic generation refuses an unknown algorithm
      Given the unknown algorithm "XS256"
      When I try to generate a key automatically for it
      Then it is refused as "unsupported_algorithm"

    Example: resolving the type of an unknown algorithm is refused
      Given the unknown algorithm "XS256"
      When I try to resolve the key type for it
      Then it is refused as "unsupported_algorithm"

  Rule: a key imports from every format and exports back unchanged

    Scenario Outline: <type> imports from <format> explicitly and by detection alike
      Given the <type> fixture key
      When I import it with from.<format>
      And I import it again by detection
      Then the key has type "<type>"
      And both keys carry the id of the input
      And both keys export the same private JWK
      And importing the key's own JWK export reproduces it

      Examples:
        | type | format |
        | AKP  | b64    |
        | AKP  | der    |
        | AKP  | jwk    |
        | AKP  | pem    |
        | EC   | b64    |
        | EC   | der    |
        | EC   | jwk    |
        | EC   | pem    |
        | oct  | b64    |
        | oct  | der    |
        | oct  | jwk    |
        | oct  | pem    |
        | OKP  | b64    |
        | OKP  | der    |
        | OKP  | jwk    |
        | OKP  | pem    |
        | RSA  | b64    |
        | RSA  | der    |
        | RSA  | jwk    |
        | RSA  | pem    |

    Scenario Outline: a public-only <type> key imports from DER explicitly and by detection alike
      Given the <type> fixture key without its id
      When I import its public half with from.der
      And I import it again by detection
      Then the key has type "<type>"
      And the key carries only a public half
      And both keys derive the same key id
      And both keys export the same public JWK
      And importing the key's own JWK export reproduces it

      Examples:
        | type |
        | AKP  |
        | EC   |
        | OKP  |
        | RSA  |

    Scenario Outline: a private-only <type> key imports from DER and derives its public half
      Given the <type> fixture key without its id
      When I import its private half with from.der
      And I import it again by detection
      Then the key has type "<type>"
      And the key carries both a private and a public half
      And both keys derive the same key id
      And both keys export the same public JWK
      And importing the key's own JWK export reproduces it

      Examples:
        | type |
        | AKP  |
        | EC   |
        | OKP  |
        | RSA  |

    Example: an oct key imports from a UTF-8 secret
      Given the oct fixture secret
      When I import it as UTF-8
      Then the key has type "oct" and use "sig"
      And the key's algorithm is "HS512"
      And the key carries only a private half

    Example: the same passphrase, path and algorithm derive the same key
      Given the passphrase "correct horse"
      When I derive an "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v1"
      And I derive another "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v1"
      Then both keys have identical private material
      And both keys have the same id

    Example: a different derivation path derives a different key
      Given the passphrase "correct horse"
      When I derive an "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v1"
      And I derive another "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v2"
      Then both keys have different private material
      And both keys have different ids

    Example: an oct seed key derives a deterministic child
      Given a generated "A256KW" key
      When I derive an "HS256" key from it along the path "urn:lindorm:test:kek:v1"
      Then deriving again from it along the path "urn:lindorm:test:kek:v1" reproduces the derived key

    Example: an explicit id wins over the derived id
      Given the passphrase "correct horse"
      When I derive an "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v1" with id "key_explicit0000"
      Then the key's id is "key_explicit0000"

    Example: a stored key restores from its database row
      Given a generated "ES256" key
      When I restore the key from its database row
      Then the restored key matches the key's database row
      And both keys export the same private JWK

    Example: a value in no known format is refused
      Given the string "not a key"
      When I try to import it by detection
      Then it is refused as "unknown_key_format"

    Example: a PEM import without an algorithm is refused
      Given the EC fixture PEM without its algorithm
      When I try to import it from PEM
      Then it is refused as "missing_algorithm"

    Example: a PEM import without a use is refused
      Given the EC fixture PEM without its use
      When I try to import it from PEM
      Then it is refused as "missing_key_use"

    Example: a PEM import without a type is refused
      Given the EC fixture PEM without its type
      When I try to import it from PEM
      Then it is refused as "invalid_key_format"

  Rule: provenance is decided by the import path, never by the payload

    Example: a key loaded from an env string is internal
      Given a generated "ES256" key
      When I export it as an env string
      And I import the env string
      Then the imported key is internal

    Example: a key imported from a JWK is not internal
      Given a generated "ES256" key
      When I import its private JWK
      Then the imported key is not internal

    Example: a JWK imported with the provenance flag is internal
      Given a generated "ES256" key
      When I import its private JWK as our own
      Then the imported key is internal

    Example: a payload-borne internal flag is ignored
      Given a generated "ES256" key
      When I import its private JWK carrying an internal flag
      Then the imported key is not internal

    Example: a JWK imported with the provenance flag off is not internal
      Given a generated "ES256" key
      When I import its private JWK as foreign
      Then the imported key is not internal

    Example: a generated key is internal
      Given a generated "ES256" key
      Then the key is internal

    Example: a derived key is internal
      Given the passphrase "correct horse"
      When I derive an "HS256" key from the passphrase along the path "urn:lindorm:test:kek:v1"
      Then the key is internal

    Example: a key imported from a UTF-8 secret is internal
      Given the oct fixture secret
      When I import it as UTF-8
      Then the key is internal

    Example: a JWK without a publish member imports unpublished
      Given a generated "ES256" key
      When I import its public JWK
      Then the imported key is unpublished

    Example: a JWK carrying a publish member keeps it
      Given a generated "ES256" key that is published
      When I import its private JWK
      Then the imported key is published

    Example: a JWK carrying publish false imports unpublished
      Given a generated "ES256" key that is published
      When I import its private JWK carrying publish false
      Then the imported key is unpublished

    Example: a generated key is unpublished
      Given a generated "ES256" key
      Then the key is unpublished

  Rule: an env string carries the whole private key

    Example: the env string is CBOR by default
      Given a generated "ES256" key
      When I export it as an env string
      Then the env string payload is a CBOR map

    Scenario Outline: <format> env strings re-import the whole <published> key
      Given a generated "ES256" key that is <published>
      When I export it as a "<format>" env string
      Then the env string payload is <payload>
      And I import the env string
      And the imported key matches the key's id, thumbprint and publish flag

      Examples:
        | format | payload       | published   |
        | cbor   | a CBOR map    | published   |
        | cbor   | a CBOR map    | unpublished |
        | json   | a JSON object | published   |
        | json   | a JSON object | unpublished |

    Example: a string without the kryptos prefix is refused
      Given the env string "kryptoz:AAAA"
      When I try to import the env string
      Then it is refused as "invalid_kryptos_string"

    Example: a prefixed payload that is neither JSON nor a CBOR map is refused
      Given a prefixed env string with an opaque payload
      When I try to import the env string
      Then it is refused as "invalid_kryptos_string"

    Example: a CBOR env string of an unknown version is refused
      Given a CBOR env string declaring version 99
      When I try to import the env string
      Then it is refused as "invalid_cbor_env"

    Example: a CBOR env string with an unknown label is refused
      Given a CBOR env string carrying the unknown label 7
      When I try to import the env string
      Then it is refused as "invalid_cbor_env"

  Rule: a key id is stable and never guessable from a secret

    Scenario Outline: <algorithm> derives its id from the key's thumbprint
      Given a generated "<algorithm>" key
      Then the key's id is a 16-character key id
      And importing its public JWK without a kid reproduces the id
      And importing its private PEM without an id reproduces the id

      Examples:
        | algorithm |
        | ES256     |
        | EdDSA     |
        | RS256     |
        | ML-DSA-44 |

    Example: an explicit id wins at generation
      Given the generation options
        | id | key_explicit0000 |
      When I generate an "ES256" key with those options
      Then the key's id is "key_explicit0000"

    Example: a JWK kid wins on import
      Given a generated "ES256" key
      When I import its public JWK with kid "key_customKid0000"
      Then the imported key's id is "key_customKid0000"

    Example: a database row keeps its id
      Given a generated "ES256" key
      When I restore the key from its database row
      Then the restored key has the same id as the key

    Example: an env string keeps its id
      Given a generated "ES256" key
      When I export it as an env string
      And I import the env string
      Then the imported key has the same id as the key

    Example: an oct key without an id gets a random id
      Given a generated "HS256" key
      And another generated "HS256" key
      Then the key's id is a 16-character key id
      And both keys have different ids

    Example: two oct keys with the same secret get different ids
      Given a generated "HS256" key
      When I import its private JWK without a kid
      Then both keys have different ids
      And importing its private JWK without a kid again yields yet another id

  Rule: a clone carries the material and honours the overwrite

    Example: a clone equals its source
      Given a generated "ES256" key
      When I clone the key
      Then the clone has the same id as the key
      And the clone matches the key's database row
      And both keys export the same private JWK

    Example: an overwrite wins over the source
      Given a generated "ES256" key
      When I clone the key overwriting
        | id        | key_clone0000000          |
        | purpose   | rotated                   |
        | expiresAt | 2040-01-01T00:00:00.000Z  |
      Then the clone's id is "key_clone0000000"
      And the clone's purpose is "rotated"
      And the clone expires at "2040-01-01T00:00:00.000Z"
      And both keys have identical private material

    Example: cloning leaves the source untouched
      Given a generated "ES256" key
      When I clone the key overwriting
        | id      | key_clone0000000 |
        | purpose | rotated          |
      Then the key's database row is unchanged
      And the key's purpose is null

  Rule: a key is recognised by its brand, not by its class

    Example: a generated key is recognised
      Given a generated "ES256" key
      Then the key is recognised as a Kryptos key

    Example: an unbranded object shaped like a key is not recognised
      Given an unbranded object shaped like a key
      Then it is not recognised as a Kryptos key
      And it does not narrow as an oct key

    Scenario Outline: <value> is not recognised
      Given a candidate that is <value>
      Then it is not recognised as a Kryptos key

      Examples:
        | value     |
        | null      |
        | undefined |
        | a string  |
        | a number  |
        | an array  |

    Example: a key branded by a foreign copy of the library is recognised
      Given a key branded by a foreign copy of the library
      Then it is recognised as a Kryptos key
      And it narrows as an oct key and not as an EC key

    Scenario Outline: <type> narrows to exactly its own type
      Given the algorithm "<algorithm>"
      When I generate a signing key of type "<type>" with it
      Then the guards answer akp <akp>, ec <ec>, oct <oct>, okp <okp> and rsa <rsa>

      Examples:
        | type | algorithm | akp   | ec    | oct   | okp   | rsa   |
        | AKP  | ML-DSA-44 | true  | false | false | false | false |
        | EC   | ES256     | false | true  | false | false | false |
        | oct  | HS256     | false | false | true  | false | false |
        | OKP  | EdDSA     | false | false | false | true  | false |
        | RSA  | RS256     | false | false | false | false | true  |

  Rule: an asymmetric key can be stamped with an X.509 certificate

    Example: a self-signed leaf carries its own certificate
      Given the algorithm "ES256"
      When I generate a key with it and a self-signed certificate for subject "leaf"
      Then the key has a certificate
      And the certificate thumbprint is present
      And the certificate's subject and issuer are both "leaf"
      And the certificate is not a CA
      And the certificate chain has 1 certificate

    Example: a root CA certificate declares itself a CA
      Given a root CA key with path length 1
      Then the CA's certificate is a CA with path length 1

    Example: a CA-signed leaf verifies against its root
      Given a root CA key
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the certificate chain has 2 certificates
      And the certificate is not a CA
      And the certificate verifies against the CA

    Example: a three-tier chain verifies against the root
      Given a root CA key with path length 1
      And an intermediate CA signed by it with path length 0
      When I generate an "ES256" key signed by the CA with subject "leaf"
      Then the certificate chain has 3 certificates
      And the certificate verifies against the root

    Example: asynchronous generation stamps a certificate alike
      Given the algorithm "ES256"
      When I asynchronously generate a key with it and a self-signed certificate for subject "leaf"
      Then the key has a certificate
      And the certificate's subject and issuer are both "leaf"

    Example: a symmetric key cannot carry a certificate
      Given the algorithm "HS256"
      When I try to generate a key with it and a self-signed certificate
      Then it is refused as "symmetric_key_certificate_unsupported"

    Example: a CA without a certificate cannot sign
      Given a generated "ES256" key as the CA
      Then generating an "ES256" key signed by the CA is refused as "missing_ca_certificate"

    Example: a leaf cannot act as a CA
      Given a self-signed "ES256" leaf as the CA
      Then generating an "ES256" key signed by the CA is refused as "invalid_ca_certificate"

    Example: a child cannot outlive its CA
      Given a root CA key
      Then generating an "ES256" key signed by the CA expiring "2050-01-01T00:00:00.000Z" is refused as "invalid_certificate_validity_window"

    Example: a CA with path length 0 cannot issue an intermediate
      Given a root CA key with path length 0
      Then generating an intermediate CA signed by the CA is refused as "invalid_intermediate_ca_path_length"

    Example: environments never mix in one chain
      Given a root CA key in the "development" environment
      Then generating an "ES256" key signed by the CA in the "production" environment is refused as "cross_environment_certificate_signing"

    Example: a JWK whose certificate thumbprint disagrees with its chain is refused
      Given a generated "ES256" key with a self-signed certificate for subject "leaf"
      When I try to import its public JWK with a tampered certificate thumbprint
      Then it is refused as "certificate_thumbprint_mismatch"
