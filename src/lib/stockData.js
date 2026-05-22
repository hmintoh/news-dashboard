import fetch from "node-fetch";
import { sleep } from "./utils.js";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const USE_ALPHA_VANTAGE = Boolean(API_KEY);

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

async function fetchStooqStockData(tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return [];
  }

  const symbolList = tickers.map((ticker) => `${ticker}.US`).join("+");
  const url = `https://stooq.com/q/l/?s=${symbolList}&f=sd2t2ohlcv&h&e=csv`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Stooq request failed: ${response.status} ${response.statusText}`,
    );
  }

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const results = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i].split(",");
    if (row.length < 8) continue;

    const symbolRaw = row[0]?.trim();
    const closePrice = parseFloat(row[6]);
    const openPrice = parseFloat(row[3]);

    if (!symbolRaw || Number.isNaN(closePrice)) {
      continue;
    }

    const symbol = symbolRaw.replace(/\.US$/i, "").toUpperCase();
    const changePercent =
      Number.isFinite(openPrice) && openPrice !== 0
        ? ((closePrice - openPrice) / openPrice) * 100
        : null;

    results.push({
      symbol,
      currentPrice: closePrice,
      previousPrice: Number.isFinite(openPrice) ? openPrice : null,
      changePercent,
      latestDate: null,
      previousDate: null,
    });
  }

  return results;
}

export async function getStockData(tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return [];
  }

  const results = [];
  const unresolved = [];
  let exceededAlphaLimit = false;

  for (let index = 0; index < tickers.length; index += 1) {
    const symbol = tickers[index];

    if (!USE_ALPHA_VANTAGE || exceededAlphaLimit) {
      unresolved.push(symbol);
      continue;
    }

    const url = `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${API_KEY}&outputsize=compact`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `Alpha Vantage request failed for ${symbol}: ${response.status} ${response.statusText}`,
        );
        unresolved.push(symbol);
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

        if (message.toLowerCase().includes("rate limit")) {
          exceededAlphaLimit = true;
        }

        unresolved.push(symbol);
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
      console.warn(
        `Skipping ${symbol} due to fetch/parsing error: ${err.message}`,
      );
      unresolved.push(symbol);
    } finally {
      if (index < tickers.length - 1) {
        await sleep(1200);
      }
    }
  }

  if (unresolved.length > 0) {
    try {
      const fallbackResults = await fetchStooqStockData(unresolved);
      if (fallbackResults.length) {
        console.log(
          `Stooq fallback returned ${fallbackResults.length} ticker(s).`,
        );
      }
      results.push(...fallbackResults);
    } catch (err) {
      console.warn(
        `Stooq fallback failed for tickers [${unresolved.join(", ")}]: ${err.message}`,
      );
    }
  }

  return results;
}
