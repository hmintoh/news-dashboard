import "dotenv/config";
import { analyzeNews } from "./src/lib/aiAgent.js";

async function runTest() {
  try {
    const headline =
      "U.S., Iran signal peace progress — but remain at odds over enriched uranium, Strait of Hormuz tolls";
    const description =
      "Officials on both sides said there were signs of progress in talks, but disagreements remain on nuclear enrichment and shipping security in the Gulf.";

    const result = await analyzeNews(headline, description);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error analyzing news:", error);
    process.exitCode = 1;
  }
}

runTest();
