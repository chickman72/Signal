import "dotenv/config";
import { AzureKeyCredential, SearchClient } from "@azure/search-documents";

type SearchDocument = Record<string, unknown>;

let client: SearchClient<SearchDocument> | null = null;

export function getSearchClient() {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_SEARCH_KEY?.trim();
  const indexName = process.env.AZURE_SEARCH_INDEX?.trim() || "signal-index";

  if (!endpoint || !apiKey) {
    throw new Error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY.");
  }

  if (!client) {
    client = new SearchClient<SearchDocument>(
      endpoint,
      indexName,
      new AzureKeyCredential(apiKey),
    );
  }

  return client;
}

export function searchClient() {
  return getSearchClient();
}
