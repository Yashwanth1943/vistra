/**
 * One-time idempotent migration script to copy existing SQLite users and active sessions
 * into MongoDB Atlas without losing existing user data.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." MONGODB_DB="vistra" node scripts/migrate-sqlite-to-mongo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MongoClient } from 'mongodb';

const sqlitePath = path.resolve(process.cwd(), process.env.SQLITE_PATH || './data/vistra.db');
const mongoUri = process.env.MONGODB_URI?.trim();
const mongoDbName = process.env.MONGODB_DB?.trim() || 'vistra';

if (!mongoUri) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.log(`No SQLite database found at ${sqlitePath}; nothing to migrate.`);
  process.exit(0);
}

const sqlite = new DatabaseSync(sqlitePath);
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(mongoDbName);

  const usersCol = db.collection('users');
  const sessionsCol = db.collection('sessions');

  await usersCol.createIndex({ email: 1 }, { unique: true, name: 'idx_users_email_unique' });
  await usersCol.createIndex({ id: 1 }, { unique: true, name: 'idx_users_id_unique' });
  await sessionsCol.createIndex({ sessionTokenHash: 1 }, { unique: true, name: 'idx_sessions_token_hash_unique' });

  const users = sqlite.prepare('SELECT * FROM users').all();
  let migratedUsers = 0;
  for (const row of users) {
    const normalizedEmail = String(row.email).trim().toLowerCase();
    await usersCol.updateOne(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          id: row.id,
          name: row.name,
          email: normalizedEmail,
          emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
          role: row.role || 'student',
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        },
      },
      { upsert: true },
    );
    migratedUsers++;
  }

  const nowIso = new Date().toISOString();
  const sessions = sqlite.prepare('SELECT * FROM sessions WHERE expires_at > ?').all(nowIso);
  let migratedSessions = 0;
  for (const row of sessions) {
    await sessionsCol.updateOne(
      { sessionTokenHash: row.session_token_hash },
      {
        $setOnInsert: {
          id: row.id,
          userId: row.user_id,
          sessionTokenHash: row.session_token_hash,
          expiresAt: new Date(row.expires_at),
          createdAt: new Date(row.created_at),
        },
      },
      { upsert: true },
    );
    migratedSessions++;
  }

  console.log(`Migration complete: ${migratedUsers} user(s) checked/upserted, ${migratedSessions} active session(s) checked/upserted.`);
} finally {
  sqlite.close();
  await client.close();
}
