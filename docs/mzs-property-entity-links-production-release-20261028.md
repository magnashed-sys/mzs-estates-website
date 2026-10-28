# MZS Group — Legal attribution by physical property / Production stage 2A

**Status:** additive schema prepared for independent review. No legal relationship will be inferred, changed, deleted or automatically assigned. No sales invoice, lease, capital or payment records are affected.

## Release boundaries

- Two empty, append-only tables: `mzs_ops_property_entity_links` and `mzs_ops_property_entity_link_audit`.
- Administrator must manually choose a registered physical property, a registered issuing legal entity, a relation (`owner`, `payer`, `manager`), an effective date and an evidence reference. Submission carries an explicit attestation.
- Direct `UPDATE`/`DELETE`, unauthenticated `SELECT` and user-supplied audit author/verification timestamp are forbidden. Audit trigger snapshots the original link and authenticated actor.
- No automatic owner-to-entity assumption based on free text or private ownership labels; these links are **internal administrative attribution**, not a tax/legal opinion. No VAT determination, ledger posting or accountant submission.
- The two linked legal entity source registers remain unchanged. This release deliberately has no new UI to avoid exposing an incomplete flow before its schema is verified.
- Exact original Staging DDL is reused, with two additional FK covering indexes. The PGlite fixture tests admin insert, audit, duplicate prevention, inactive admins, client denial and immutable rows.
- Existing Production pilot run/scopes for the two IJmuiden trial accounts must stay untouched. The pilot release allowlist is updated only for the exact approved Production deployment commit, not bypassed.

## Rollout and validation

1. Exact-head full GitHub CI (tests/build/typecheck and security), plus a READY Vercel Preview connected only to Supabase **Staging**.
2. Production SQL transactional **ROLLBACK** rehearsal, checking both empty tables/related existing source schema compatibility.
3. Merge this isolated schema PR; update Production release SHA allowlist and deploy reviewed commit. Apply the recorded Supabase Production migration, after owner-confirmed ready backup, with no data seeding.
4. Confirm: two tables with RLS, zero anonymous SELECT, zero authenticated direct UPDATE/DELETE, no initial links or audit rows, normal property and issuer source counts, security advisor, existing bookings, contracts, Capital and pilot activity totals unchanged.
5. Add the separate dedicated Group Admin UI only after schema verification, with direct server role check, evidence confirmation, explicit written warnings about immutability and no automatic finance effects.

**Recovery:** leave the empty additive tables in place for immediate rollback to previous app code; do not drop tables or restore full database while legitimate booking/capital records may have advanced. The owner has confirmed a backup is ready, but actual restore proof has not been independently observed.
