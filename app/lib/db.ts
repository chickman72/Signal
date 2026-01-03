import { CosmosClient } from '@azure/cosmos';

// Lazy load the client so it doesn't crash on server boot
let client: CosmosClient | null = null;

function getClient() {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;

    // If keys are missing in Azure, log it but don't crash the entire app immediately
    if (!endpoint || !key) {
      console.error("Azure Cosmos DB Environment Variables are missing!");
      return null;
    }

    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

export async function getUsersContainer() {
  const c = getClient();
  if (!c) throw new Error("Database not connected");
  const database = c.database('SignalApp');
  return database.container('Users');
}

export async function getCoursesContainer() {
  const c = getClient();
  if (!c) throw new Error("Database not connected");
  const database = c.database('SignalApp');
  return database.container('Courses');
}

export async function getLogsContainer() {
  const c = getClient();
  if (!c) throw new Error("Database not connected");
  const database = c.database('SignalApp');
  return database.container('ActivityLogs');
}
