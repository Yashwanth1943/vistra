import { MongoClient, type Collection, type Db } from 'mongodb';
import { sanitizeAuthError } from './auth/http-error';

export interface UserDocument {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: string;
  authProviders?: string[];
  googleSub?: string;
  avatarUrl?: string | null;
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

export interface EmailOtpDocument {
  id: string;
  purpose: 'register' | 'login';
  email: string;
  pendingName?: string;
  userId?: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  resendAvailableAt: Date;
  createdAt: Date;
}

export interface VistraCollections {
  users: Collection<UserDocument>;
  magicLinks: Collection<MagicLinkDocument>;
  sessions: Collection<SessionDocument>;
  rateLimits: Collection<RateLimitDocument>;
  emailOtps: Collection<EmailOtpDocument>;
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
      console.error('[mongodb:connect]', sanitizeAuthError(error));
      throw error;
    });
  }
  return globalThis._vistraMongoClientPromise;
}

export async function ensureGoogleSubPartialIndex(usersCol: Collection<UserDocument>): Promise<void> {
  const existingIndexes = await usersCol.indexes();
  const current = existingIndexes.find((idx) => idx.name === 'idx_users_google_sub_unique');
  const hasPartialStringFilter =
    current &&
    typeof current.partialFilterExpression === 'object' &&
    current.partialFilterExpression !== null &&
    (current.partialFilterExpression as { googleSub?: { $type?: string } }).googleSub?.$type === 'string';

  if (current && !hasPartialStringFilter) {
    await usersCol.dropIndex('idx_users_google_sub_unique');
  }

  await usersCol.updateMany(
    { googleSub: null as unknown as string },
    { $unset: { googleSub: '' } },
  );

  if (!hasPartialStringFilter) {
    await usersCol.createIndex(
      { googleSub: 1 },
      {
        unique: true,
        partialFilterExpression: { googleSub: { $type: 'string' } },
        name: 'idx_users_google_sub_unique',
      },
    );
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  const usersCol = db.collection<UserDocument>('users');
  await Promise.all([
    usersCol.createIndex({ email: 1 }, { unique: true, name: 'idx_users_email_unique' }),
    usersCol.createIndex({ id: 1 }, { unique: true, name: 'idx_users_id_unique' }),
    ensureGoogleSubPartialIndex(usersCol),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ tokenHash: 1 }, { unique: true, name: 'idx_magic_token_hash_unique' }),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ userId: 1 }, { name: 'idx_magic_user_id' }),
    db.collection<MagicLinkDocument>('magicLinks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600, name: 'idx_magic_expires_ttl' }),
    db.collection<SessionDocument>('sessions').createIndex({ sessionTokenHash: 1 }, { unique: true, name: 'idx_sessions_token_hash_unique' }),
    db.collection<SessionDocument>('sessions').createIndex({ userId: 1 }, { name: 'idx_sessions_user_id' }),
    db.collection<SessionDocument>('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_sessions_expires_ttl' }),
    db.collection<RateLimitDocument>('rateLimits').createIndex({ key: 1 }, { unique: true, name: 'idx_rate_limits_key_unique' }),
    db.collection<RateLimitDocument>('rateLimits').createIndex({ resetAt: 1 }, { expireAfterSeconds: 0, name: 'idx_rate_limits_reset_ttl' }),
    db.collection<EmailOtpDocument>('emailOtps').createIndex({ id: 1 }, { unique: true, name: 'idx_email_otps_id_unique' }),
    db.collection<EmailOtpDocument>('emailOtps').createIndex({ email: 1, purpose: 1, createdAt: -1 }, { name: 'idx_email_otps_email_purpose' }),
    db.collection<EmailOtpDocument>('emailOtps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600, name: 'idx_email_otps_expires_ttl' }),
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
    emailOtps: db.collection<EmailOtpDocument>('emailOtps'),
  };
}
