const EmbeddedPostgres = require('embedded-postgres').default;
const path = require('path');

async function run() {
  const dbPath = path.resolve(__dirname, '../.pgdata');
  const port = parseInt(process.env.PG_PORT || '5433', 10);
  const pg = new EmbeddedPostgres({
    port,
    databaseDir: dbPath,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  try {
    console.log(`[Postgres] Starting PostgreSQL 18 server on port ${port}...`);
    await pg.start();
    console.log(`[Postgres] PostgreSQL is LIVE and ready for connections on port ${port}`);
  } catch (e) {
    console.error('[Postgres Startup Error]:', e.message);
  }

  // Keep daemon alive
  setInterval(() => {}, 10000);
}

run();
