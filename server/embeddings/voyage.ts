// Voyage AI embeddings. Docs: https://docs.voyageai.com/reference/embeddings-api
import { EMBEDDING_DIMENSIONS } from "../db/schema";

export const EMBEDDING_MODEL = "voyage-4";
// Stored in movies.embedding_model. Changing the model or dimensions re-embeds everything.
export const EMBEDDING_MODEL_TAG = `${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS}`;

type InputType = "document" | "query";

export async function embed(
  texts: string[],
  inputType: InputType,
): Promise<{ vectors: number[][]; tokens: number }> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
        usage: { total_tokens: number };
      };
      const vectors = body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      return { vectors, tokens: body.usage.total_tokens };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) {
      throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
  }
}
