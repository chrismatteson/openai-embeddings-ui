import { HandleRequest, HttpRequest, HttpResponse } from "@fermyon/spin-sdk";
import { Configuration, CreateCompletionRequest, CreateEmbeddingRequest, OpenAIApi } from "openai";
const similarity = require('compute-cosine-similarity');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
<<<<<<< Updated upstream
  console.log("1")
  const store = spinSdk.kv.openDefault();
  console.log("2")
  let status = 200;
  let body;
  console.log("2.1")
  const { apiKey, action, websites, prompt } = JSON.parse(decoder.decode(request.body));
  console.log("2.2")
  let configuration = new Configuration({
    apiKey: apiKey,
  });
  console.log("3")
  switch (action) {
    case "create_embedding":
      console.log("4")
      for (const website of websites) {
        console.log("5")
        const embedding = await createEmbedding(website);
        store.set(website, encoder.encode(JSON.stringify(embedding)).buffer);
      }
      body = "Embedding created successfully";
      console.log("6")
      break;
    case "query":
      console.log("7")
      const response = await queryModel(prompt);
      body = response;
      break;
    default:
      break;
  }
=======
  try {
    console.log("1")
    const store = spinSdk.kv.openDefault();
    console.log("2")
    let status = 200;
    let body;
    console.log("2.1")
    const { apiKey, action, websites, prompt } = JSON.parse(decoder.decode(request.body));
    console.log("2.2")
    const configuration = new Configuration({
      apiKey: apiKey,
    });
    
    const openai = new OpenAIApi(configuration);
    console.log("3")
    switch (action) {
      case "create_embedding":
        console.log("4")
        for (const website of websites) {
          console.log("5")
          const embedding = await createEmbedding(openai, website);
          store.set(website, encoder.encode(JSON.stringify(embedding)).buffer);
        }
        body = "Embedding created successfully";
        console.log("6")
        break;
      case "query":
        console.log("7")
        const response = await queryModel(openai, prompt);
        body = response;
        break;
      default:
        break;
    }
>>>>>>> Stashed changes

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
  console.log("8")
  const response = await openai.createEmbedding({ input: [text], model: "text-embedding-ada-002" });
  console.log("9")
  return response.data.data[0].embedding;
}

async function queryModel(openai: OpenAIApi, prompt: string): Promise<string> {
  console.log("10")
  const promptEmbedding = await createEmbedding(openai, prompt);
  const embeddings = await fetchAllEmbeddings();
  console.log("11")
  let promptWithEmbeddings = prompt;
  embeddings.forEach((embedding) => {
    if (calculateCosineSimilarity(embedding, promptEmbedding) > 0.8) {
      promptWithEmbeddings += "\n" + embedding.join(', ');
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

async function fetchAllEmbeddings(): Promise<number[][]> {
  const store = spinSdk.kv.openDefault();
  console.log("15")
  const keys = await store.getKeys();
  const embeddings: number[][] = [];

  for (const key of keys) {
    const val = store.get(key);
    embeddings.push(parseEmbedding(decoder.decode(val)));
  }

  return embeddings;
}

function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  return similarity(embedding1, embedding2);
}

function parseEmbedding(embedding: string): number[] {
  // Parse the embedding string into an array of numbers
  return JSON.parse(embedding);
}