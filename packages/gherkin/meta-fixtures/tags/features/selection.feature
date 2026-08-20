Feature: outline separation

  Scenario Outline: rows excluded wholesale
    Given a noted step "<value>"

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
