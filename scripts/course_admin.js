#!/usr/bin/env node
// scripts/course_admin.js
// Simple admin utility to inspect and fix a course item in Cosmos DB.

const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = 'SignalApp';
const containerId = 'Courses';

if (!endpoint || !key) {
  console.error('ERROR: COSMOS_ENDPOINT and COSMOS_KEY environment variables are required.');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

async function showCourse(courseId) {
  const { resources } = await container.items
    .query({ query: 'SELECT * FROM c WHERE c.course_id = @courseId', parameters: [{ name: '@courseId', value: courseId }] })
    .fetchAll();
  if (!resources || resources.length === 0) {
    console.log('No course found with id:', courseId);
    return null;
  }
  console.log(`Found ${resources.length} matching item(s) for course_id ${courseId}:`);
  resources.forEach((r, idx) => {
    console.log(`--- ITEM ${idx + 1} ----------------`);
    // Print a compact summary to make scanning easier
    console.log(`id: ${r.id || r.course_id}`);
    console.log(`username: ${r.username || '(none)'}`);
    console.log(`_hasQuizHistory: ${typeof r.quizHistory !== 'undefined'}`);
    console.log(`_etag: ${r._etag || 'n/a'}  _ts: ${r._ts || 'n/a'}`);
    try {
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.log('[Unable to stringify item]');
    }
  });
  return resources;
}

async function upsertCourse(item) {
  // Ensure id is set to course_id to satisfy Cosmos item id requirement
  item.id = item.id || item.course_id;
  const res = await container.items.upsert(item);
  console.log('Upsert result status:', res.statusCode || res.status);
  return res;
}

async function confirm(prompt) {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdout.write(prompt + ' (y/N): ');
    process.stdin.once('data', function(data) {
      const d = data.toString().trim().toLowerCase();
      resolve(d === 'y' || d === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help') {
    console.log('Usage: node scripts/course_admin.js <command> [args]');
    console.log('Commands:');
    console.log('  show <courseId>                     - Display course item(s) matching course_id');
    console.log('  find-duplicates <courseId>          - Print summary for all items with this course_id');
    console.log('  set-username <courseId> <username>  - Set username on course item and upsert (uses first item)');
    console.log('  set-quiz <courseId> <jsonPath>      - Load quizHistory JSON from file and upsert (uses first item)');
    console.log('  fix-missing-username <courseId> <username> - Sets username if missing (uses first item)');
    console.log('  patch-progress <courseId> <jsonPath>   - Load a CourseProgress JSON from file and upsert (uses first item)');
  }

  try {
    if (cmd === 'show') {
      const courseId = args[1];
      if (!courseId) return console.error('Missing courseId');
      await showCourse(courseId);

    } else if (cmd === 'find-duplicates') {
      const courseId = args[1];
      if (!courseId) return console.error('Missing courseId');
      await showCourse(courseId);

    } else if (cmd === 'set-username') {
      const courseId = args[1];
      const username = args[2];
      if (!courseId || !username) return console.error('Usage: set-username <courseId> <username>');
      const item = await showCourse(courseId);
      if (!item) return;
      item.username = username;
      const ok = await confirm(`Upsert course ${courseId} with username='${username}'?`);
      if (!ok) return console.log('Aborted.');
      await upsertCourse(item);
      console.log('Done.');

    } else if (cmd === 'set-quiz') {
      const courseId = args[1];
      const jsonPath = args[2];
      if (!courseId || !jsonPath) return console.error('Usage: set-quiz <courseId> <jsonPath>');
      if (!fs.existsSync(jsonPath)) return console.error('File not found:', jsonPath);
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const item = await showCourse(courseId) || { course_id: courseId };
      item.quizHistory = json;
      const ok = await confirm(`Upsert course ${courseId} with quizHistory from ${jsonPath}?`);
      if (!ok) return console.log('Aborted.');
      await upsertCourse(item);
      console.log('Done.');

    } else if (cmd === 'patch-progress') {
      const courseId = args[1];
      const jsonPath = args[2];
      if (!courseId || !jsonPath) return console.error('Usage: patch-progress <courseId> <jsonPath>');
      if (!fs.existsSync(jsonPath)) return console.error('File not found:', jsonPath);
      const progress = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const items = await showCourse(courseId);
      if (!items || items.length === 0) return console.error('Course not found:', courseId);
      const item = items[0];
      item.progress = progress;
      const ok = await confirm(`Upsert course ${courseId} with provided progress from ${jsonPath}?`);
      if (!ok) return console.log('Aborted.');
      await upsertCourse(item);
      console.log('Done.');

    } else if (cmd === 'fix-missing-username') {
      const courseId = args[1];
      const username = args[2];
      if (!courseId || !username) return console.error('Usage: fix-missing-username <courseId> <username>');
      const item = await showCourse(courseId);
      if (!item) return;
      if (item.username) return console.log('Item already has username:', item.username);
      item.username = username;
      const ok = await confirm(`Upsert course ${courseId} with username='${username}'?`);
      if (!ok) return console.log('Aborted.');
      await upsertCourse(item);
      console.log('Done.');

    } else {
      console.error('Unknown command:', cmd);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    process.stdin.pause();
  }
}

main();
