# Core conventions

- Return neverthrow `Result` for expected failures.
- Direct `throw` statements are banned in `src/**` (Oxlint error). Tests and development configuration are exempt.
- Do not broadly catch defects and disguise them as generic `Err` values.
