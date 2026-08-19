Feature: Docker-backed notebook

  Example: an integration-lane note round-trips
    Given a fresh notebook
    When I write "integration note"
    Then reading returns "integration note"
