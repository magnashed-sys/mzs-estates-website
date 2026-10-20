# Villa La Nucia photo presentation — review draft

20 October 2026. Local feature branch: feature/la-nucia-photo-walkthrough.
No production deployment, database writes, emails or booking changes.

59 source files inspected. IMG_6871.PNG is a camera-app screenshot; excluded.
32 photographs selected across 8 chapters. WebP assets total 8,553,180 bytes
versus 26,042,983 bytes for selected source assets (including generated edits).
Maximum edge 1920px; responsive Next Image delivery; originals retained.

Bedding only was digitally tidied in IMG_6865, IMG_6866 and IMG_6870 using
image generation. These edits are disclosed in gallery captions and the tour.
The edited views still need owner acceptance before release.

The tour is a chapter-based photographic walkthrough, not a 360-degree tour
or a measured floor plan. No unverified room connections are represented.

Implementation retains project/offering access gates, rental calendar,
prices and enquiry handling. Only Villa La Nucia presentation content changes.

Offline preview generation:

    node scripts/build-la-nucia-review.cjs /absolute/path/Villa-La-Nucia-Preview.html

The HTML embeds images and requires no network. It has no live booking actions.
The protected site implementation remains the canonical code; the offline
HTML is a visual/interaction proposal, not the complete authenticated portal.

Validation: 18 existing regression tests passed; Next.js build and type check
passed. Existing unrelated CSS alignment warnings remain.
Browser interaction/visual tests could not run: Chromium unavailable and
browser downloads failed. No browser test pass is claimed.

Outstanding: owner approval of photo selection, room labels and bedding edits;
authenticated Staging review of the full property page and booking navigation;
remote branch integration with current main; isolated Vercel Preview and release
approval. This branch starts from the local PR22 implementation checkpoint.

Review revision: Outdoor living now contains poolside seating, the outdoor
terrace, barbecue area and outdoor shower (6882, 6884, 6886, 6885).
The gallery deduplicates reused outdoor views: 28 unique selected photographs.
Guest entrances and kitchen views are removed from this chapter.
