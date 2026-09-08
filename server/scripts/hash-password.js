import { hashPassword } from '../lib/adminCredentials.js';

/**
 * Turns a password into the hash that belongs in ADMIN_USERS.
 *
 *   node scripts/hash-password.js 'their password'
 *
 * The password is passed as an argument rather than prompted so this can be
 * run once and the output pasted straight into .env. Clear your shell history
 * afterwards — the plaintext will be sitting in it.
 *
 * Imported from `adminCredentials.js`, NOT `adminAuth.js`. They both export
 * this function, but `adminAuth` opens a database pool the moment it is
 * imported, and that pool refuses to be built without PGDATABASE, PGUSER and
 * PGPASSWORD. Hashing a password needs none of those. Going through the wrong
 * one makes this script fail on a fresh box with "Missing required
 * environment variable PGDATABASE" — which is the exact machine, and the exact
 * moment, it exists to be useful on. The split between the two modules is
 * there for cases like this; this is the case.
 */
const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Refusing: use at least 12 characters. This guards real candidates\' personal data.');
  process.exit(1);
}

console.log(hashPassword(password));
