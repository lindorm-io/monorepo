Feature: outline separation

  Scenario Outline: rows excluded wholesale
    Given a noted step "<value>"
    Then the note reads "<value>"

    @slow
    Examples:
      | value |
      | one   |
      | two   |

  Scenario Outline: zero rows
    Given a noted step "<value>"

    @smoke
    Examples:
      | value |
