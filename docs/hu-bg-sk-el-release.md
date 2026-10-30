# Hungarian, Bulgarian, Slovak and Greek

Adds `hu`, `bg`, `sk`, `el` to public pages, account preferences, client catalogs, account notification mail and rental mail. Each catalog has all 1,160 English source keys with matching ICU argument names. Country labels/order are committed snapshots to prevent server/browser ICU hydration differences.

Existing flag order is retained; Slovak follows Czech, Hungarian follows Polish, and Bulgarian and Greek follow Romanian. Public canonical/hreflang/sitemap support now covers 24 languages and 120 marketing URLs. Admin, private, API and token paths remain unprefixed. Language never grants access.

Auth provider templates are review artifacts, not automatically deployed provider configuration. The `*-twenty-four-languages.html` files retain all prior language branches and the exact English fallback. The previous twenty-language artifacts remain available. Confirmation and recovery URLs are unchanged. Applying provider templates remains a separate deferred step.

Local validation: 622 tests passed; TypeScript check passed. Targeted checks cover catalog key/ICU parity, plural and fractional rendering, menu order, private URL preservation, preference resolution, country snapshots, privacy copy, private mail links and escaping, and public sitemap behavior. No real registration, booking or mail was submitted for these checks.

Staging build, browser review and production release must be recorded after completion.
