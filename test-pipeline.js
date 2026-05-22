import "dotenv/config";
import fs from "fs";
import { runPipeline } from "./src/lib/pipeline.js";

async function runTest() {
  try {
    const dataset = await runPipeline();
    console.log("Pipeline completed.");

    const dashboardPath = "./src/data/dashboard.json";
    const exists = fs.existsSync(dashboardPath);
    console.log(`Dashboard file created: ${exists}`);

    if (!exists) {
      throw new Error("Dashboard file not found after pipeline execution.");
    }

    console.log(
      `Dataset summary: ${dataset.articles.length} articles, lastUpdated=${dataset.lastUpdated}`,
    );
  } catch (error) {
    console.error("Pipeline test failed:", error);
    process.exitCode = 1;
  }
}

runTest();
