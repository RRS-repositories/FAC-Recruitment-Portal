import { hashPassword } from '../lib/adminAuth.js';

/**
 * Turns a password into the hash that belongs in ADMIN_USERS.
 *
 *   node scripts/hash-password.js 'their password'
 *
 * The password is passed as an argument rather than prompted so this can be
 * run once and the output pasted straight into .env. Clear your shell history
 * afterwards — the plaintext will be sitting in it.
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
