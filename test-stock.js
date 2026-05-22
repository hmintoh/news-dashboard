import "dotenv/config";
import { getStockData } from "./src/lib/stockData.js";

async function runTest() {
  try {
    const tickers = ["NVDA"];
    const result = await getStockData(tickers);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error fetching stock data:", error);
    process.exitCode = 1;
  }
}

runTest();
