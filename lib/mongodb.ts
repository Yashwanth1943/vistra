import { MongoClient, type Collection, type Db } from 'mongodb';

export interface UserDocument {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MagicLinkDocument {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface SessionDocument {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RateLimitDocument {
  key: string;
  count: number;
  resetAt: Date;
}

export interface VistraCollections {
  users: Collection<UserDocument>;
  magicLinks: Collection<MagicLinkDocument>;
  sessions: Collection<SessionDocument>;
  rateLimits: Collection<RateLimitDocument>;
}

declare global {
  // eslint-disable-next-line no-var
  var _vistraMongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _vistraMongoIndexesReady: Promise<void> | undefined;
}

let testDbOverride: Db | null = null;

export function setMongoDbForTests(db: Db | null): void {
  testDbOverride = db;
}

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured.');
  }
  return uri;
}

function getMongoDbName(): string {
  return process.env.MONGODB_DB?.trim() || 'vistra';
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalThis._vistraMongoClientPromise) {
    const client = new MongoClient(getMongoUri(), {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    });
    globalThis._vistraMongoClientPromise = client.connect().catch((error) => {
      globalThis._vistraMongoClientPromise = undefined;
      throw error;
    });
  }
  return globalThis._vistraMongoClientPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<UserDocument>('users').createIndex({ email: 1 }, { unique: true, name: 'idx_users_email_unique' }),
    db.collection<UserDocument>('users').createIndex({ id: 1 }, { unique: true, name: 'idx_users_id_unique' }),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ tokenHash: 1 }, { unique: true, name: 'idx_magic_token_hash_unique' }),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ userId: 1 }, { name: 'idx_magic_user_id' }),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600, name: 'idx_magic_expires_ttl' }),
    db.collection<SessionDocument>('sessions').createIndex({ sessionTokenHash: 1 }, { unique: true, name: 'idx_sessions_token_hash_unique' }),
    db.collection<SessionDocument>('sessions').createIndex({ userId: 1 }, { name: 'idx_sessions_user_id' }),
    db.collection<SessionDocument>('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_sessions_expires_ttl' }),
    db.collection<RateLimitDocument>('rateLimits').createIndex({ key: 1 }, { unique: true, name: 'idx_rate_limits_key_unique' }),
    db.collection<RateLimitDocument>('rateLimits').createIndex({ resetAt: 1 }, { expireAfterSeconds: 0, name: 'idx_rate_limits_reset_ttl' }),
  ]);
}

export async function getMongoDb(): Promise<Db> {
  if (testDbOverride) {
    return testDbOverride;
  }
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  if (!globalThis._vistraMongoIndexesReady) {
    globalThis._vistraMongoIndexesReady = ensureIndexes(db).catch((error) => {
      globalThis._vistraMongoIndexesReady = undefined;
      throw error;
    });
  }
  await globalThis._vistraMongoIndexesReady;
  return db;
}

export async function getCollections(): Promise<VistraCollections> {
  const db = await getMongoDb();
  return {
    users: db.collection<UserDocument>('users'),
    magicLinks: db.collection<MagicLinkDocument>('magicLinks'),
    sessions: db.collection<SessionDocument>('sessions'),
    rateLimits: db.collection<RateLimitDocument>('rateLimits'),
  };
}
