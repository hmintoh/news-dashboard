import fetch from "node-fetch";
import { sleep } from "./utils.js";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

if (!API_KEY) {
  throw new Error(
    "Missing Alpha Vantage API key. Set process.env.ALPHA_VANTAGE_API_KEY.",
  );
}

function parseDailySeries(series) {
  const dates = Object.keys(series).sort((a, b) => new Date(b) - new Date(a));
  if (dates.length < 2) {
    throw new Error("Not enough daily data points returned by Alpha Vantage.");
  }

  const [latestDate, previousDate] = dates;
  const latestClose = parseFloat(series[latestDate]["4. close"]);
  const previousClose = parseFloat(series[previousDate]["4. close"]);
  const changePercent = ((latestClose - previousClose) / previousClose) * 100;

  return {
    currentPrice: latestClose,
    previousPrice: previousClose,
    changePercent,
    latestDate,
    previousDate,
  };
}

export async function getStockData(tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return [];
  }

  const results = [];

  for (let index = 0; index < tickers.length; index += 1) {
    const symbol = tickers[index];
    const url = `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${API_KEY}&outputsize=compact`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `Alpha Vantage request failed for ${symbol}: ${response.status} ${response.statusText}`,
        );
        continue;
      }

      const data = await response.json();
      const series = data["Time Series (Daily)"];

      if (!series) {
        const message =
          data["Note"] ||
          data["Information"] ||
          data["Error Message"] ||
          "Unexpected Alpha Vantage response";
        console.warn(
          `Alpha Vantage returned invalid data for ${symbol}: ${message}`,
        );
        continue;
      }

      const parsed = parseDailySeries(series);
      results.push({
        symbol,
        currentPrice: parsed.currentPrice,
        previousPrice: parsed.previousPrice,
        changePercent: parsed.changePercent,
        latestDate: parsed.latestDate,
        previousDate: parsed.previousDate,
      });
    } catch (err) {
      console.warn(`Skipping ${symbol} due to fetch/parsing error: ${err.message}`);
    } finally {
      if (index < tickers.length - 1) {
        await sleep(1200);
      }
    }
  }

  return results;
}
