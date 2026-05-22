import { getNewsArticles } from "./src/lib/newsData.js";

async function runTest() {
  try {
    const articles = await getNewsArticles();
    console.log("Latest headlines:");
    articles.slice(0, 5).forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   ${article.url}`);
      console.log(`   ${article.date.toISOString()}`);
      console.log("");
    });
  } catch (error) {
    console.error("Error fetching news articles:", error);
    process.exitCode = 1;
  }
}

runTest();
