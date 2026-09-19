Feature: A signed token sealed in an encrypting envelope

  Sign-then-encrypt composes the two verbs: the claims are signed, so their
  origin can be established, and the signed token is sealed, so it travels
  confidential. The envelope declares what it holds, the reader opens it and
  then checks the inner signature, and a sealed value that carries no
  signature is refused by the verb whose job is origin.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token sealed around a signed claims token declares that nesting in its envelope

    A nested token declares itself with `cty`, so a recipient knows to process
    the plaintext as a token rather than as opaque bytes: on JOSE the
    parameter is required for a nested JWT and its value is "JWT"
    (RFC 7519 §5.2), and COSE carries the content type of the payload at
    label 3 (RFC 9052 §3.1). Without the declaration a reader holding the key
    recovers a byte string it has no reason to treat as a credential, and the
    inner signature — the only thing that says who issued the claims — is
    never checked. The declaration is read off the envelope's raw protected
    header by the independent inspector. The COSE value is the CWT media
    type, whose registration is a document this row does not cite. The
    minted result reports the signed token's own kind, with the envelope
    beside it, so a caller asking what the token is gets one answer whether
    or not it was sealed.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint is asked to seal the token

    @RFC-7519
    Scenario: jose: the envelope's protected header declares the nested JWT (RFC-7519 §5.2)
      When I mint the content under the "id_token" profile on the jose wire
      Then the raw protected header carries "cty" "JWT"

    @RFC-9052
    Scenario: cose: the envelope's protected header declares the nested CWT at the content-type label (RFC-9052 §3.1)
      When I mint the content under the "id_token" profile on the cose wire
      Then the raw protected header carries label 3 "application/cwt"

    Scenario Outline: <wire>: the minted token reports the signed kind as its own, with the envelope beside it
      When I mint the content under the "id_token" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports the wrapper "<wrapper>"

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |

  Rule: a token sealed around a signed claims token is decrypted and its inner signature checked

    Encryption provides confidentiality and says nothing about origin. A
    sealed credential therefore has to be opened and its inner signature
    verified before its claims may be believed, and the caller must get the
    inner token's own header and claims rather than the envelope's — the
    envelope is written by whoever sealed it, the inner token by whoever
    issued it, and a floor applied to the wrong one polices the wrong party.
    The header reported is the inner token's: an id token's own media type in
    each wire's spelling, not the encrypting outer's.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint is asked to seal the token

    Scenario Outline: <wire>: the verified result reports the signed token's kind, with the envelope beside it
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"
      And the verified token reports the wrapper "<wrapper>"

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |

    Scenario Outline: <wire>: the verified claims are the inner token's
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified claims include
        | subject | user-1                   |
        | issuer  | https://test.lindorm.io/ |

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the verified header is the inner token's, carrying its own media type
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified header includes
        | headerType | "<typ>" |

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: an encrypted token whose plaintext is not a signed token is refused by the verify verb

    Verification is a statement about origin, and decryption proves only
    that the holder had the key — which the presenter also had, since it
    wrote the ciphertext. A verify that returned the claims of an unsigned
    encrypted payload would report an authenticated credential assembled
    entirely by the party presenting it, so a plaintext carrying no
    signature has to be refused rather than reported. The refusal names the
    encrypting format it opened.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |

    Scenario Outline: <wire>: the verify is refused as a domain error naming the encrypting format
      When I encrypt the data on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "verify_requires_signature"
      And the refusal reports the format "<format>"

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |
