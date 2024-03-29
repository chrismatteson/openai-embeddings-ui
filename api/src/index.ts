import { HandleRequest, HttpRequest, HttpResponse, Kv } from "@fermyon/spin-sdk";
import { Configuration, OpenAIApi } from "openai";
import * as htmlparser2 from "htmlparser2";
import { arrayBuffer } from "stream/consumers";
const cosine = require('talisman/metrics/cosine');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface KeyValPair {
  key: string;
  value: number[];
}

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
  try {
    const store = Kv.openDefault();
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
          const contentArray = content.match(/[\s\S]{1,4096}/g);
          if (contentArray) {
            for (let i = 0; i < contentArray.length; i++) {
              const embedding = await createEmbedding(openai, contentArray[i]);
              const key = website + ":" + i; // Append the index to the key
              console.log("storing " + key + " embedding");
              store.set(key, encoder.encode(JSON.stringify({
                "content": contentArray[i],
                "embedding": embedding
              })).buffer);
            };
          }
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
    let combinedEmbeddings = "Info:" + "\n";
    embeddings.forEach((embedding) => {
      if (calculateCosineSimilarity(embedding.value, promptEmbedding) > 0.8) {
        console.log("greater than 0.8!")
        combinedEmbeddings += "\n" + embedding.key;
      }
    });
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {"role": "user", "content": combinedEmbeddings},
        {"role": "user", "content": "Question: " + prompt}
      ]
    });
    if (completion.data.choices[0].message?.content) {
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
  const store = Kv.openDefault();
  const keys = await store.getKeys();
  const keyValPairs: KeyValPair[] = [];

  for (const key of keys) {
    if (key.startsWith("http")) {
      const val = await store.get(key);
      const decodedVal = decoder.decode(val || new Uint8Array());
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
