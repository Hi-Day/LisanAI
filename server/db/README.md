# Database Portability Boundary

LisanAI currently uses libSQL/SQLite through `server/database.js`.

The application layer should depend only on the small database contract exposed by `getDb()`:

- `all(sql, ...params)`
- `get(sql, ...params)`
- `run(sql, ...params)`
- `exec(sql)`

## Rules

1. Do not import `@libsql/client`, `sqlite`, or `sqlite3` from application/domain services.
2. Keep tenant scoping explicit in queries for tenant-owned data.
3. Keep schema changes in numbered migrations.
4. Avoid SQLite-only SQL in new application code unless documented as a compatibility requirement.
5. Do not introduce PostgreSQL-specific SQL until a PostgreSQL adapter exists.
6. Evaluation traces and AI telemetry should remain separable from transactional assessment data as the system scales.

## Migration strategy

The next production database target is PostgreSQL. Migration should happen in two controlled steps:

1. Stabilize the application against the database contract and eliminate engine-specific assumptions.
2. Add a PostgreSQL adapter and run compatibility/integration tests before changing the production database.

This is intentionally not a big-bang database migration. The current libSQL deployment remains supported while the portability boundary is hardened.
