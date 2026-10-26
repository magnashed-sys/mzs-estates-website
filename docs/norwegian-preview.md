# Norwegian Bokmål preview

Adds Norwegian Bokmål (`nb`, `nb_NO`, Norsk bokmål, Norwegian flag) to the existing localization system. Nynorsk is not included. This branch is preview only; the four preceding languages were separately approved and published through PR #109.

The catalogue contains all 1,132 English-source entries. Locally generated machine-assisted draft copy has been manually corrected for public navigation, account status, capital terminology, financial conditions, rental quantities and critical notices. Account/rental notification copy and signup/recovery templates are prepared in Norwegian. Auth templates remain prepared files, not installed Supabase settings.

Native-speaker editorial review, mobile visual acceptance and full authenticated account acceptance remain outstanding before publication. The preview uses staging public Supabase settings, SMTP port 0 and captured rental emails; no real registrations, bookings or outgoing mail are required for this check.

Validation covers catalogue/placeholder parity, plural forms (1 natt / 2 netter), safe mail links and escaping, unchanged financial privacy, recovery tokens, registration language persistence and visitor path filtering.
