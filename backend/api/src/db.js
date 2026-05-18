import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDB() {
  if (db) return db;
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27018/simulator';
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();

  // Create indexes
  await db.collection('sim_periods').createIndex({ runId: 1 });
  await db.collection('sim_runs').createIndex({ startedAt: -1 });
  await db.collection('sim_configs').createIndex({ createdAt: -1 });
  await db.collection('sim_prompts').createIndex({ createdAt: -1 });

  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}
