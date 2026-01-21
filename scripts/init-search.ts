import { config as loadEnv } from "dotenv";
import { AzureKeyCredential, SearchIndexClient, type SearchIndex } from "@azure/search-documents";

loadEnv({ path: ".env.local" });
loadEnv();

const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
const apiKey = process.env.AZURE_SEARCH_KEY;
const indexName = process.env.AZURE_SEARCH_INDEX ?? "signal-index";

if (!endpoint || !apiKey) {
  console.error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY.");
  process.exit(1);
}

const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

const index: SearchIndex = {
  name: indexName,
  fields: [
    { name: "id", type: "Edm.String", key: true, filterable: true, sortable: true },
    { name: "content", type: "Edm.String", searchable: true },
    { name: "courseId", type: "Edm.String", filterable: true, facetable: true },
    { name: "sourcefile", type: "Edm.String", filterable: true, facetable: true },
    {
      name: "embedding",
      type: "Collection(Edm.Single)",
      searchable: true,
      vectorSearchDimensions: 1536,
      vectorSearchProfileName: "my-vector-profile",
    },
  ],
  vectorSearch: {
    algorithms: [
      {
        name: "my-hnsw",
        kind: "hnsw",
        parameters: {
          metric: "cosine",
          m: 4,
          efConstruction: 400,
          efSearch: 500,
        },
      },
    ],
    profiles: [
      {
        name: "my-vector-profile",
        algorithmConfigurationName: "my-hnsw",
      },
    ],
  },
};

async function ensureIndex(): Promise<void> {
  try {
    await client.getIndex(indexName);
    console.log(`Search index "${indexName}" already exists.`);
    return;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== 404) {
      throw error;
    }
  }

  await client.createIndex(index);
  console.log(`Created search index "${indexName}".`);
}

ensureIndex().catch((error) => {
  console.error("Failed to initialize search index:", error);
  process.exit(1);
});
