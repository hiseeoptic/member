// Usage:
//   node --env-file=.env scripts/make-admin.mjs            -> list all users
//   node --env-file=.env scripts/make-admin.mjs <email>    -> promote that email to ADMIN
import pg from "pg";

const { Client } = pg;
const email = process.argv[2];

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

if (!email) {
  const { rows } = await client.query(
    `SELECT email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" ASC`
  );
  console.log("Users:");
  for (const r of rows) {
    console.log(`  - ${r.email}  [${r.role}]  ${r.name ?? ""}`);
  }
  console.log(`\nTo promote: node --env-file=.env scripts/make-admin.mjs <email>`);
} else {
  const { rowCount, rows } = await client.query(
    `UPDATE "User" SET role = 'ADMIN' WHERE email = $1 RETURNING email, role`,
    [email]
  );
  if (rowCount === 0) {
    console.log(`No user found with email: ${email}`);
  } else {
    console.log(`Promoted: ${rows[0].email} -> ${rows[0].role}`);
  }
}

await client.end();
