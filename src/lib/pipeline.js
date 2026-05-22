// Daily data pipeline
// 1. Fetch news articles (last 24h)
// 2. For each article, call AI agent to analyze
// 3. Fetch stock prices for all mentioned tickers
// 4. Combine into one dataset with structure:
//    { article, sentiment, tickers: [{symbol, price, change}] }
// 5. Save to src/data/dashboard.json
// Add delays between AI calls to respect rate limits (1 sec between calls)

import fs from "fs";
import { getNewsArticles } from "./newsData.js";
import { analyzeNews } from "./aiAgent.js";
import { getStockData } from "./stockData.js";
import { sleep } from "./utils.js";

export async function runPipeline() {
  console.log("Starting dashboard pipeline...");

  try {
    const articles = await getNewsArticles();
    console.log(`Fetched ${articles.length} news articles.`);

    const analyzedArticles = [];
    const tickerSet = new Set();

    for (let i = 0; i < articles.length; i += 1) {
      const article = articles[i];
      console.log(
        `Analyzing article ${i + 1}/${articles.length}: ${article.title}`,
      );

      const description =
        typeof article.description === "string"
          ? article.description.trim()
          : "";

      if (!description) {
        console.warn(
          `Skipping article ${article.title} because it has no description.`,
        );
        continue;
      }

      try {
        const analysis = await analyzeNews(article.title, description);
        const normalizedTickers = (analysis.affectedTickers || []).map(
          (ticker) => ticker.toUpperCase(),
        );

        normalizedTickers.forEach((ticker) => tickerSet.add(ticker));

        analyzedArticles.push({
          title: article.title,
          url: article.url,
          date:
            article.date instanceof Date
              ? article.date.toISOString()
              : new Date(article.date).toISOString(),
          sentiment: analysis.sentiment,
          impact: analysis.impact,
          tickers: normalizedTickers,
        });
      } catch (analysisError) {
        console.error(
          `Failed to analyze article ${article.title}:`,
          analysisError,
        );
      }

      if (i < articles.length - 1) {
        await sleep(1000);
      }
    }

    const uniqueTickers = Array.from(tickerSet);
    console.log(
      `Collected ${uniqueTickers.length} unique ticker(s): ${uniqueTickers.join(", ")}`,
    );

    let stockPrices = [];
    if (uniqueTickers.length > 0) {
      stockPrices = await getStockData(uniqueTickers);
      console.log(`Fetched stock data for ${stockPrices.length} ticker(s).`);
    }

    const priceMap = new Map();
    for (const stock of stockPrices) {
      priceMap.set(stock.symbol.toUpperCase(), {
        symbol: stock.symbol,
        price: stock.currentPrice,
        change: stock.changePercent,
      });
    }

    const dataset = {
      lastUpdated: new Date().toISOString(),
      articles: analyzedArticles.map((item) => ({
        title: item.title,
        url: item.url,
        date: item.date,
        sentiment: item.sentiment,
        impact: item.impact,
        tickers: item.tickers.map(
          (symbol) =>
            priceMap.get(symbol) || { symbol, price: null, change: null },
        ),
      })),
    };

    const outputPath = new URL("../data/dashboard.json", import.meta.url)
      .pathname;
    fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), "utf-8");
    console.log(`Saved dashboard dataset to ${outputPath}`);

    return dataset;
  } catch (error) {
    console.error("Dashboard pipeline failed:", error);
    throw error;
  }
}
