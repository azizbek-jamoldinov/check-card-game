#!/usr/bin/env node

/**
 * Check Card Game — Database Management
 *
 * Usage:
 *   node scripts/db.mjs flush [--remote]
 *   node scripts/db.mjs delete-user <guestId> [--remote]
 *   node scripts/db.mjs list-users [--remote]
 */

import mongoose from 'mongoose';
import { execSync } from 'child_process';

const LOCAL_URI = 'mongodb://localhost:27017/check-card-game';
const RESOURCE_GROUP = 'check-card-game-rg';
const COSMOS_ACCOUNT = 'check-card-game-cosmo-db';

function getRemoteUri() {
  console.log('==> Fetching Cosmos DB connection string...');
  const raw = execSync(
    `az cosmosdb keys list --name ${COSMOS_ACCOUNT} --resource-group ${RESOURCE_GROUP} --type connection-strings --query "connectionStrings[0].connectionString" -o tsv`,
    { encoding: 'utf-8' },
  ).trim();
  // Insert database name before query params
  // URI format: mongodb://account:key@host:10255/?ssl=true&...
  // We need:    mongodb://account:key@host:10255/check-card-game?ssl=true&...
  return raw.replace('/?', '/check-card-game?').replace('//?', '/check-card-game?');
}

function getUri(remote) {
  return remote ? getRemoteUri() : LOCAL_URI;
}

async function connect(uri) {
  const opts = {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
  };
  if (uri.includes('cosmos.azure.com')) {
    opts.retryWrites = false;
    opts.tls = true;
    opts.directConnection = true;
  }
  await mongoose.connect(uri, opts);
}

async function flush(remote) {
  if (remote) {
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question(
        'WARNING: This will drop the PRODUCTION database on Cosmos DB!\nType "yes" to confirm: ',
        resolve,
      );
    });
    rl.close();
    if (answer !== 'yes') {
      console.log('Aborted.');
      return;
    }
  }

  const target = remote ? 'remote (Cosmos DB)' : 'local';
  console.log(`==> Flushing ${target} database...`);

  const uri = getUri(remote);
  await connect(uri);

  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const col of collections) {
    console.log(`  Dropping: ${col.name}`);
    await mongoose.connection.db.dropCollection(col.name);
  }

  console.log('Database flushed.');
  await mongoose.disconnect();
}

async function deleteUser(guestId, remote) {
  if (!guestId) {
    console.log('Error: guestId is required');
    console.log('Usage: node scripts/db.mjs delete-user <guestId> [--remote]');
    process.exit(1);
  }

  const target = remote ? 'remote (Cosmos DB)' : 'local';
  console.log(`==> Deleting user '${guestId}' from ${target} database...`);

  const uri = getUri(remote);
  await connect(uri);
  const db = mongoose.connection.db;

  // Delete guest profile
  const profileResult = await db.collection('guestprofiles').deleteMany({ guestId });
  console.log(`  Guest profiles deleted: ${profileResult.deletedCount}`);

  // Delete game results where this user participated
  const gameResult = await db.collection('gameresults').deleteMany({ 'players.guestId': guestId });
  console.log(`  Game results deleted: ${gameResult.deletedCount}`);

  // Remove from active rooms
  const roomResult = await db
    .collection('rooms')
    .updateMany({ 'players.guestId': guestId }, { $pull: { players: { guestId } } });
  console.log(`  Rooms updated: ${roomResult.modifiedCount}`);

  console.log('User deleted.');
  await mongoose.disconnect();
}

async function listUsers(remote) {
  const target = remote ? 'remote (Cosmos DB)' : 'local';
  console.log(`==> Listing users from ${target} database...`);

  const uri = getUri(remote);
  await connect(uri);
  const db = mongoose.connection.db;

  const users = await db
    .collection('guestprofiles')
    .find({}, { projection: { _id: 0, guestId: 1, username: 1, lastSeenAt: 1 } })
    .sort({ lastSeenAt: -1 })
    .toArray();

  if (users.length === 0) {
    console.log('  No users found.');
  } else {
    console.log(`  ${users.length} user(s):`);
    console.log(`  ${'USERNAME'.padEnd(20)}${'GUEST ID'.padEnd(25)}LAST SEEN`);
    console.log(`  ${'-'.repeat(65)}`);
    for (const u of users) {
      const seen = u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : 'unknown';
      console.log(`  ${(u.username || '').padEnd(20)}${(u.guestId || '').padEnd(25)}${seen}`);
    }
  }

  await mongoose.disconnect();
}

// --- CLI ---
const args = process.argv.slice(2);
const command = args[0];
const remote = args.includes('--remote');
const nonFlagArgs = args.filter((a) => a !== '--remote');

try {
  switch (command) {
    case 'flush':
      await flush(remote);
      break;
    case 'delete-user':
      await deleteUser(nonFlagArgs[1], remote);
      break;
    case 'list-users':
      await listUsers(remote);
      break;
    default:
      console.log('Check Card Game — Database Management\n');
      console.log('Usage:');
      console.log('  node scripts/db.mjs flush [--remote]                Drop entire database');
      console.log(
        '  node scripts/db.mjs delete-user <guestId> [--remote] Delete a user and their records',
      );
      console.log('  node scripts/db.mjs list-users [--remote]           List all guest profiles');
      console.log('\nAdd --remote to target production Cosmos DB instead of local MongoDB.');
      break;
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
