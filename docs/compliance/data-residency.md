# Data residency

**Short answer.** Keep the database on Neon in Frankfurt (`eu-central-1`) for now, run the app’s functions
in Vercel’s Dubai region (`dxb1`), and document the transfer basis. Move to a UAE region only when a customer
contract or the revenue makes it worth the migration.

## What is true today

- Neon has no UAE or Saudi region. Frankfurt is its closest European region.
- Vercel functions can run in `dxb1` (Dubai), so the request is handled near the user even when the database
  is in Europe.
- Vercel Blob is in `cdg1` (Paris) for uploaded files and invoice PDFs.
- Nothing in the code depends on the database being in a particular country. A move is an infrastructure
  change, not a rewrite.

## Why Frankfurt is acceptable

- UAE PDPL allows cross-border processing when the controller takes appropriate safeguards and tells people
  what happens. Standard contractual clauses and a documented necessity are the usual basis.
- Saudi PDPL allows transfers to jurisdictions with adequate protection, or with safeguards. Frankfurt is a
  common choice.
- Egypt’s PDPL is stricter about sensitive data and some cross-border transfers. The data here is ordinary
  account, education and payment data, not health or biometric data. Still, confirm with an Egyptian adviser
  before marketing heavily there.
- Latency from Dubai to Frankfurt is roughly 100 ms. For page loads and checkout that is acceptable. It is not
  acceptable for a real-time classroom, which is why live video runs through Daily, not the database.

## Options

| Option | What it gives | Cost and effort | When to choose |
|---|---|---|---|
| Neon Frankfurt (current) | Managed Postgres, backups, low ops | Lowest | Now |
| AWS `me-central-1` (Dubai) with RDS Postgres | Data stays in the UAE; same region as `dxb1` | Migration, new backups, higher ops | A school or government contract requires UAE residency, or volume justifies it |
| A UAE-hosted managed Postgres | Local contract and support | Vendor-dependent; check backups and exit | When a UAE customer demands a local contract |
| Self-hosted Postgres | Full control | Highest ops and security burden | Not recommended at this size |

## What to tell a customer

Say: “Your account data is stored with Neon in the European Union (Frankfurt) under standard contractual
clauses. The application runs from Vercel’s Dubai region. Payment card data is handled by Ziina in the UAE.”
Do not promise UAE-only storage until the migration is done.

## Trigger to migrate

- A signed contract that names UAE data residency as a condition.
- A school group or government buyer that will not proceed otherwise.
- Sustained latency or egress cost that outweighs the migration.

When that happens, the migration is: provision RDS in `me-central-1`, restore a Neon dump, point
`DATABASE_URL` at it, run the migrations, verify the health check, then switch the Vercel environment. Keep
the old database read-only for a week before deleting it.
