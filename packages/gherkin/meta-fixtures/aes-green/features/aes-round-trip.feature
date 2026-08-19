Feature: AES round trip

  Rule: content survives a round trip

    Example: default mode
      Given an oct key with algorithm "A128KW" and encryption "A128GCM"
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
