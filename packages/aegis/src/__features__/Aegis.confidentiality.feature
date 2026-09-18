Feature: The confidentiality verb

  `encrypt` and `decrypt` are a pure confidentiality pair: they hide a value
  from everyone without the key and make no statement about what the value
  means. A decrypt hands back the object it was given, key for key, and leaves
  the vocabulary to the verbs that verify an author.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: an object sealed by the confidentiality verb is recovered under the keys its writer chose

    A reader that renamed the recovered keys into a registered vocabulary would
    be asserting, on the writer's behalf, that `subject` is a subject claim and
    `iss` an issuer — statements only a signature can carry. `subject` is the
    load-bearing key: its wire spellings are `sub` on JOSE and label 2 on COSE,
    so a translation on either leg shows as a missing key.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |
        | tenant  | acme   |
      And an audience list whose only member is "client-1"

    Scenario Outline: <wire>: the decrypt reports the encrypting format as the token's own kind
      When I encrypt the data on the <wire> wire
      And I decrypt the token
      Then the decrypted token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

    Scenario Outline: <wire>: the object comes back key for key, under no registered spelling
      When I encrypt the data on the <wire> wire
      And I decrypt the token
      Then the decrypted payload carries "subject" "user-1"
      And the decrypted payload carries "tenant" "acme"
      And the decrypted payload carries "audience" as the list "client-1"
      And the decrypted payload carries no "sub"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an empty member of a sealed object is returned with the object

    Pruning an empty entry is a claims decision — an issuer choosing between
    `amr: []` and no `amr` at all — and it is available to a claims verb
    because a claim is an assertion someone signed. The confidentiality verb
    asserts nothing, so an empty string, list or object the caller wrote is
    part of the value. A caller cannot compensate for a prune it did not ask
    for, because the loss is silent. `nonce` is the member that reaches the
    decision: it is a declared claim whose cell says prune, and its domain and
    JOSE spellings coincide.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt is the object
        """json
        { "blank": "", "none": [], "empty": {}, "kept": "x", "nonce": "" }
        """

    Scenario Outline: <wire>: the empty string, list and object come back with the rest of the value
      When I encrypt the data on the <wire> wire
      And I decrypt the token
      Then the decrypted payload is exactly the object
        """json
        { "blank": "", "none": [], "empty": {}, "kept": "x", "nonce": "" }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an opaque payload sealed by the confidentiality verb is recovered verbatim

    Not everything worth sealing is structured — session state, a handle, a
    blob the writer alone interprets. Such a payload must come back as itself,
    the same type and the same content, because a recipient that received a
    string as bytes has to guess at a conversion the writer never performed.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the text to encrypt "session-state-opaque"

    Scenario Outline: <wire>: the text comes back as the same string
      When I encrypt the text on the <wire> wire
      And I decrypt the token
      Then the decrypted payload is the text "session-state-opaque"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a decrypted token reports the token type its envelope declared

    The envelope's type parameter is what lets a recipient route an encrypted
    object before it has opened it, and the recipient must then be able to read
    that declaration back off the result — otherwise the routing decision and
    the object it routed cannot be correlated.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |
      And the token type "access_token"

    Scenario Outline: <wire>: the decrypted result reports the type the envelope declared
      When I encrypt the data on the <wire> wire
      And I decrypt the token
      Then the decrypted header reports the token type "access_token"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the decrypt verb refuses a token that carries no ciphertext

    A decrypt handed a signed token has nothing to decrypt, and the only
    alternatives to refusing are worse: returning the payload would report a
    cleartext token as one whose confidentiality had been established, and
    returning nothing would leave the caller unable to tell success from an
    empty token.

    Background:
      Given the payload to sign
        | hello | world |

    Scenario Outline: <wire>: a signed token is refused
      When I sign the payload as opaque content on the <wire> wire
      And I decrypt the token
      Then decryption is refused as an aegis error

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refuses an encryption request for a profile that declares itself unencryptable

    Whether a profile's artifact may be sealed is a property of the artifact's
    role: an access token is presented to resource servers that were never
    enumerated at issue, so there is no recipient to seal it to. Treating the
    request as a silent no-op is the dangerous reading — the caller believes
    the token is confidential while it travels in the clear. The vault holds a
    recipient key on both wires, so the refusal is attributable to the
    profile's own declaration and to nothing else.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the mint is asked to seal the token

    Scenario Outline: <wire>: the mint is refused, naming the profile that declared itself unencryptable
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error
      And the refusal names the profile "access_token"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint asked to seal a token with no resolvable recipient key refuses rather than signing it in the clear

    An explicit encryption request is a statement that the content must not
    travel readable. When no recipient key can be resolved that request cannot
    be honoured, and the only two outcomes are refusing and emitting cleartext,
    so the failure must surface. The vault holds the signing key alone, so
    there is no recipient the token could be sealed to.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint is asked to seal the token

    Scenario Outline: <wire>: the mint is refused as a key error
      When I mint the content under the "id_token" profile on the <wire> wire
      Then minting is refused as a key error

      Examples:
        | wire |
        | jose |
        | cose |
