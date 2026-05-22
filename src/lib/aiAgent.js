import fetch from "node-fetch";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error("Missing Groq API key. Set process.env.GROQ_API_KEY.");
}

const systemMessage = {
  role: "system",
  content:
    "You are an AI assistant that analyzes financial news headlines and descriptions for stock ticker mentions, sentiment, and impact.",
};

const assistantInstructions = `
Return only valid JSON with the following structure:
{
  "affectedTickers": ["AAPL"],
  "sentiment": "positive|negative|neutral",
  "impact": "Brief explanation of the impact in under 50 words."
}
Do not include any additional text, markdown, or commentary.
`;

function parseAIResponse(text) {
  try {
    const trimmed = text.trim();
    return JSON.parse(trimmed);
  } catch (err) {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonText = text.slice(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(jsonText);
      } catch (_innerErr) {
        // fall through
      }
    }
    throw new Error(
      `Invalid JSON response from Groq API: ${err.message}\nResponse: ${text}`,
    );
  }
}

function validateAnalysis(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Groq API returned a non-object response.");
  }

  if (!Array.isArray(parsed.affectedTickers)) {
    throw new Error("Missing or invalid affectedTickers array.");
  }

  if (!["positive", "negative", "neutral"].includes(parsed.sentiment)) {
    throw new Error("Missing or invalid sentiment value.");
  }

  if (typeof parsed.impact !== "string") {
    throw new Error("Missing or invalid impact text.");
  }
}

export async function analyzeNews(headline, description) {
  const trimmedDescription =
    typeof description === "string" ? description.trim() : "";
  if (!headline || !trimmedDescription) {
    throw new Error("headline and description are required.");
  }

  try {
    const prompt = `Headline: ${headline}\nDescription: ${trimmedDescription}\n\n${assistantInstructions}`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemMessage, { role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Groq API request failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Failed to parse Groq API JSON response: ${err.message} - ${text}`,
      );
    }

    const content = payload?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("Invalid Groq API payload: missing message content.");
    }

    const parsed = parseAIResponse(content);
    validateAnalysis(parsed);

    return {
      affectedTickers: parsed.affectedTickers,
      sentiment: parsed.sentiment,
      impact: parsed.impact,
    };
  } catch (err) {
    throw new Error(`analyzeNews failed: ${err.message}`);
  }
}
