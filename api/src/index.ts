import { HandleRequest, HttpRequest, HttpResponse } from "@fermyon/spin-sdk";
import { Configuration, OpenAIApi } from "openai";
import fetch from 'node-fetch';
const similarity = require('compute-cosine-similarity');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface KeyValPair {
  key: string;
  value: number[];
}

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
  try {
    const store = spinSdk.kv.openDefault();
    let status = 200;
    let body;
    const { apiKey, action, websites, prompt } = JSON.parse(decoder.decode(request.body));
    const configuration = new Configuration({
      apiKey: apiKey,
    });

    const openai = new OpenAIApi(configuration);
    switch (action) {
      case "create_embedding":
        console.log("Creating Embeddings")
        for (const website of websites) {
          const content = await fetchWebsiteHTML(website)
          const embedding = await createEmbedding(openai, content);
          store.set(content, encoder.encode(JSON.stringify(embedding)).buffer);
        }
        body = "Embedding created successfully";
        break;
      case "query":
        console.log("Sending query")
        const response = await queryModel(openai, prompt);
        body = response;
        break;
      default:
        console.log("No action specified")
        break;
    }
    return {
      status: status,
      body: body,
    };
  } catch (e) {
    console.log(`Error: ${JSON.stringify(e, null, 2)}`);
    return {
      status: 500,
      body: "Internal Server Error",
    };
  }
};

async function createEmbedding(openai: OpenAIApi, text: string): Promise<number[]> {
  const response = await openai.createEmbedding({ input: [text], model: "text-embedding-ada-002" });
  return response.data.data[0].embedding;
}

async function queryModel(openai: OpenAIApi, prompt: string): Promise<string> {
  const promptEmbedding = await createEmbedding(openai, prompt);
  const embeddings = await fetchAllEmbeddings();
  console.log("11")
  let promptWithEmbeddings = prompt;
  embeddings.forEach((embedding) => {
    if (calculateCosineSimilarity(embedding.value, promptEmbedding) > 0.8) {
      promptWithEmbeddings += "\n" + embedding.key;
    }
  });
  console.log("12")
  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: promptWithEmbeddings,
  });
  console.log("13")
  if (completion.data.choices[0].text) {
    console.log("14")
    return completion.data.choices[0].text;
  } else {
    throw new Error("No data returned");
  }
}

async function fetchAllEmbeddings(): Promise<KeyValPair[]> {
  const store = spinSdk.kv.openDefault();
  const keys = await store.getKeys();
  const keyValPairs: KeyValPair[] = [];

  for (const key of keys) {
    const val = await store.get(key);
    const decodedVal = decoder.decode(val);
    const keyValPair: KeyValPair = {
      key,
      value: Array.from(decodedVal, (byte) => byte.charCodeAt(0))
    };
    keyValPairs.push(keyValPair);
  }

  return keyValPairs;
}

function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  return similarity(embedding1, embedding2);
}

function parseEmbedding(embedding: string): number[] {
  // Parse the embedding string into an array of numbers
  return JSON.parse(embedding);
}

async function fetchWebsiteHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML from ${url}. Status: ${response.status}`);
    }
    const html = await response.text();
    return html;
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);
    throw error;
  }
}
