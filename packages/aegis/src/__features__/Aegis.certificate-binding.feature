Feature: Certificate binding

  A certificate binding is what lets a relying party tie a token to an
  identity a PKI already vouches for, rather than to a bare key it has no way
  to attribute. The two wires spell the binding with a different number of
  parameters: JOSE names the digest algorithm in the parameter — `x5t` beside
  `x5t#S256` — while COSE has one `x5t` whose value carries its own hash
  algorithm (RFC 9360 §2), so a COSE token names its certificate by exactly
  one digest and no second one rides beside it. Which digests ride is the
  wire's answer and not the caller's.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token signed by a key that carries a certificate chain names that certificate in its header

    Emitting a binding whenever the signing key carries a chain is aegis
    policy: RFC 7515 §4.1.8 makes the parameter OPTIONAL. A key that has a
    chain and emits no binding leaves the relying party unable to make the
    attribution at all, and the caller no way to know it did not travel. What
    the parameters name is the specifications' — the SHA-256 thumbprint of
    the DER-encoded certificate corresponding to the signing key
    (RFC 7515 §4.1.8), the SHA-1 thumbprint that rides beside it on JOSE
    (RFC 7515 §4.1.7), and the one `x5t` parameter COSE carries, which names
    its hash algorithm inside the value (RFC 9360 §2). The binding is
    asserted on the domain header, which is wire-agnostic, because the
    capability is that it arrives; the thumbprints are literals derived from
    the fixture certificate, never read off a token. The vault holds two
    signing keys, so the selector is what puts the certificate-bearing one in
    front of the writer.

    Background:
      Given the vault also holds a certificate-bearing ES256 signing key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint selects the signing key that carries a certificate chain

    @RFC-7515
    Scenario: jose: the verified header reports the SHA-256 thumbprint of the signing certificate (RFC-7515 §4.1.8)
      When I mint the content under the "id_token" profile on the jose wire
      And I verify the token
      Then the verified header includes
        | certificateThumbprint | "PQeZGdGGGG1A9Qr4z0qBh_TJrmoi5B-6jbMUOGn34QA" |

    @RFC-7515
    Scenario: jose: the verified header reports the SHA-1 thumbprint riding beside it (RFC-7515 §4.1.7)
      When I mint the content under the "id_token" profile on the jose wire
      And I verify the token
      Then the verified header includes
        | certificateThumbprintSha1 | "83RTODK4dhmAaqY7_fQX8atsXG4" |

    @RFC-9360
    Scenario: cose: the verified header reports the SHA-256 thumbprint of the signing certificate (RFC-9360 §2)
      When I mint the content under the "id_token" profile on the cose wire
      And I verify the token
      Then the verified header includes
        | certificateThumbprint | "PQeZGdGGGG1A9Qr4z0qBh_TJrmoi5B-6jbMUOGn34QA" |

  Rule: a token signed by a certificate-bearing key carries no binding when the issuer asks for none

    The binding is a statement about which certificate may present the
    token, and an issuer that does not want to make it must be able to
    withhold it — a deployment whose keys happen to carry a chain would
    otherwise publish a certificate identity on every token it issues, and a
    relying party configured to enforce the binding would start enforcing
    one nobody intended. The suppression must therefore be complete: a
    thumbprint left behind is a binding, whatever the chain parameter says.
    The token verifies under the certificate-bearing key, so the absence is
    the mint's decision and not a key that never had a chain.

    Background:
      Given the vault also holds a certificate-bearing ES256 signing key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint selects the signing key that carries a certificate chain
      And the mint is asked for the certificate binding "none"

    Scenario Outline: <wire>: the token verifies under the certificate-bearing key
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified header includes
        | algorithm | "ES256" |

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: neither thumbprint nor the chain reaches the verified header
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token
      Then the verified header carries no "certificateThumbprint"
      And the verified header carries no "certificateThumbprintSha1"
      And the verified header carries no "certificateChain"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint asked to bind a certificate refuses a signing key that carries no chain

    Asking for a certificate binding is a statement that the token must be
    attributable to a certificate, so a key that has none cannot honour the
    request. The two alternatives to refusing are both silent: emitting the
    token unbound leaves the issuer believing its tokens are attributable
    when they are not, and inventing a thumbprint would bind them to a
    certificate nobody holds. `x5t#S256` names the certificate corresponding
    to the signing key (RFC 7515 §4.1.8) — with no such certificate there is
    nothing the parameter could truthfully carry. The refusal is aegis
    policy, which is why the scenarios carry no tag. The vault holds the
    baseline ES512 key alone, which carries no chain.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint is asked for the certificate binding "thumbprint"

    Scenario Outline: <wire>: the mint is refused as a key error before any token exists
      When I mint the content under the "id_token" profile on the <wire> wire
      Then minting is refused as a key error "cert_binding_chain_required"

      Examples:
        | wire |
        | jose |
        | cose |
