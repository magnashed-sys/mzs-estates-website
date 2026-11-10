# About MZS Group — world map preview

Prepared for review on 10 November 2026. Do not merge as part of preparation.

- Rename the shared header's About link to About MZS Group in all 24 languages (Dutch: Over MZS Group).
- Replace the opening panorama on `/about` with a lightweight, locally hosted SVG world map.
- Highlight the Netherlands, Spain and the United Arab Emirates; mark Amsterdam, Alicante, Madrid, Ibiza, Mallorca, Dubai and Abu Dhabi.
- Keep the whole map visible on narrow screens. Display the location legend in three columns on desktop and one column on mobile; country names follow the selected locale.
- Retain the existing page text, history photo and sections.

The map uses Natural Earth public-domain geography: `ne_110m_admin_0_countries` for the world and `ne_50m_admin_0_countries` for the three highlighted countries, including the Balearic Islands. Source: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson. License: https://www.naturalearthdata.com/about/terms-of-use/.

The image has no external runtime map dependency, JavaScript or tracking. Its alternative text and visible legend use localized country names. Location labels use the existing international city names.
