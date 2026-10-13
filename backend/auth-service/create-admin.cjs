const bcrypt = require('bcrypt');
const { Client } = require('pg');
const readline = require('readline');
const fs = require('fs');

async function main() {
  const email = 'admin@jhanvicars.in';
  const mobile = '9180351635';
  const fullName = 'Jhanvi Cars Admin';

  const password = await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question('Admin password (minimum 12 characters): ', (value) => {
      rl.close();
      resolve(value);
    });
  });

  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters. No account created.');
  }

  const envLine = fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((line) => /^\s*DATABASE_URL\s*=/.test(line));

  if (!envLine) throw new Error('DATABASE_URL not found in .env');

  const databaseUrl = envLine.slice(envLine.indexOf('=') + 1)
    .trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT email, mobile_number, role
       FROM auth_schema.users
       WHERE lower(email) = lower($1) OR mobile_number = $2
       FOR UPDATE`,
      [email, mobile],
    );

    if (existing.rowCount) {
      await client.query('ROLLBACK');
      console.log('Account not created: email or mobile already exists.');
      console.table(existing.rows);
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO auth_schema.users
       (full_name, email, mobile_number, password_hash, role)
       VALUES ($1, $2, $3, $4, 'ADMIN')`,
      [fullName, email, mobile, hash],
    );

    await client.query('COMMIT');
    console.log('Admin account created successfully.');
    console.log('Email: ' + email);
    console.log('Mobile: ' + mobile);
    console.log('Role: ADMIN');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    password.length = 0;
    await client.end();
  }
}

main().catch((error) => {
  console.error('Creation failed:', error.message);
  process.exitCode = 1;
});
