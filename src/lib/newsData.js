import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const RSS_FEEDS = [
  "https://finance.yahoo.com/news/rssindex",
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  trimValues: true,
});

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinLast24Hours(date) {
  if (!(date instanceof Date)) return false;
  const now = Date.now();
  return now - date.getTime() <= 24 * 60 * 60 * 1000;
}

function normalizeItem(item) {
  if (!item) return null;
  const title = item.title || item["title"] || "";
  const url = item.link || item["link"] || "";
  const date = parseDate(
    item.pubDate || item["pubDate"] || item.pubdate || item["pubdate"],
  );
  const description = item.description || item["description"] || "";

  if (!title || !url || !date) {
    return null;
  }

  return {
    title,
    url,
    date,
    description,
  };
}

export async function getNewsArticles() {
  const allArticles = [];

  for (const feedUrl of RSS_FEEDS) {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch RSS feed ${feedUrl}: ${response.status} ${response.statusText}`,
      );
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const channel = parsed.rss?.channel || parsed.feed || parsed;
    const items = channel?.item || channel?.entry || [];
    const normalized = Array.isArray(items) ? items : [items];

    for (const rawItem of normalized) {
      const article = normalizeItem(rawItem);
      if (article && isWithinLast24Hours(article.date)) {
        allArticles.push(article);
      }
    }
  }

  return allArticles.sort((a, b) => b.date - a.date);
}
