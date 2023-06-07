import { HandleRequest, HttpRequest, HttpResponse } from "@fermyon/spin-sdk";
import { Configuration, OpenAIApi } from "openai";
import * as htmlparser2 from "htmlparser2";
const cosine = require('talisman/metrics/cosine');

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
          console.log("fetching " + website)
          const content = await fetchWebsiteHTML(website)
          console.log("embedding " +  website)
          const embedding = await createEmbedding(openai, content);
          console.log("storing " + website + " embedding")
          store.set(website, encoder.encode(JSON.stringify({
            "content": content,
            "embedding": embedding
          })).buffer)
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
  try {
    const promptEmbedding = await createEmbedding(openai, prompt);
    const embeddings = await fetchAllEmbeddings();
    console.log("11")
    let combinedEmbeddings = "Info:" + "\n";
    console.log("12")
    embeddings.forEach((embedding) => {
      if (calculateCosineSimilarity(embedding.value, promptEmbedding) > 0.7) {
        console.log(embedding.key)
        combinedEmbeddings += "\n" + embedding.key;
      }
    });
    console.log("12.1")
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {"role": "user", "content": combinedEmbeddings},
        {"role": "user", "content": "Question: " + prompt}
      ]
    });
    console.log("13")
    if (completion.data.choices[0].message?.content) {
      console.log("14")
      console.log(completion.data.choices[0].message?.content)
      return completion.data.choices[0].message?.content;
    } else {
      throw new Error("No data returned");
    }
  } catch (error) {
    console.log(`Error querying openai: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
}

async function fetchAllEmbeddings(): Promise<KeyValPair[]> {
  const store = spinSdk.kv.openDefault();
  const keys = await store.getKeys();
  const keyValPairs: KeyValPair[] = [];

  for (const key of keys) {
    if (key.startsWith("http")) {
      const val = await store.get(key);
      const decodedVal = decoder.decode(val);
      const parsedVal = JSON.parse(decodedVal);
      const keyValPair: KeyValPair = {
        key: parsedVal.content,
        value: Array.from(parsedVal.embedding)
      };
      keyValPairs.push(keyValPair);
    }
  }

  return keyValPairs;
}

function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  try {
    return cosine(embedding1, embedding2);
  } catch (error) {
    console.error(`Error calculating cosine:`, error);
    throw error;
  }
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
    const responseBody = await response.text();
    let textBody = "";
    const parser = new htmlparser2.Parser({
      ontext(text) {
        if (/^\s*$/.test(text)) {
        } else {
          textBody += "\n" + text;
        }
      },
    });
    parser.write(responseBody)
    parser.end();
    return textBody;
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);
    throw error;
  }
}
