import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import diff_extractor from "./diff_extractor.js";
import fs from "fs/promises";

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REPO = process.env.GITHUB_REPOSITORY;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;

const eventData = JSON.parse(await fs.readFile(EVENT_PATH, "utf8"));
const prNumber = eventData.pull_request.number;
const apiUrl = `https://api.github.com/repos/${REPO}`;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const diffText = await diff_extractor(`${apiUrl}/pulls/${prNumber}/files`);

if (!diffText) {
  console.log("No diff found. Exiting.");
  process.exit(0);
}

const prompt = `
You are a senior software engineer performing an AI code review. Review the following GitHub Pull Request diff:
${diffText.slice(0, 12000)}
Provide:
Provide a JSON response with the following:

1. Summary of code quality and style.
2. Notes on maintainability and readability.
3. Identify potential issues, bugs, or vulnerabilities that require developer attention.
   - Do NOT include positive feedback or cosmetic changes in the suggestions.
   - Classify each issue under categories such as [general, performance, security, refactoring, optimization, etc.].  
   - Assign a severity score from 1 (critical/major) to 5 (minor/low impact).  
   - These should be listed under the "suggestions" section, and must relate only to issues, bugs, or vulnerabilities that developers need to address based on severity.
   - Suggestions must be strictly actionable problems that need fixing, not enhancements or removals of deprecated code unless it causes a problem.
   - A very small snippet of code that can be used to fix using markdown always give a snippet of code, no text to fix should be sent.

AI response should be in json format not as markdown, directly without any extra marking send as json so that its easy to parse using JSON.parse() and inside the json you can use markdowns to highlight. Always give JSON output through out the response.
Strictly Return output as json in below format:
{
  "summary": "...",
  "weaknesses": "...",
  "suggestions": [{
        issue: "string describing only actionable issue, bug, or vulnerability and small snippet of code always required",
        score: "",
        category: ""
    }],
}
`;
console.log("Sending code to Gemini...");

let retry = 0;
const maxRetry = 3;
const aiPRBot = async () => {
  try {
    const start = Date.now();
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });
    const text = await JSON.parse(response.text);
    const end = Date.now();
    const modelResponseTime = (end - start) / 1000;
    let commentBody = `
${text.summary}

**Weaknesses:**  
${text.weaknesses}

**Suggestions:**
`;

    for (let i = 0; i < text.suggestions.length; i++) {
      const s = text.suggestions[i];
      commentBody += `\n${i + 1}. **[${s.category.toUpperCase()}]** — ${
        s.issue
      }\n*Score: ${s.score}/5*\n`;
    }

    console.log(commentBody, prNumber, apiUrl, REPO;

    const res = await fetch(`${apiUrl}/issues/${prNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: `
# AI PR REVIEW BOT

${commentBody}
**Model Info:**
- Version: ${response.modelVersion}
- Prompt Tokens: ${response.usageMetadata.promptTokenCount}
- Candidates Tokens: ${response.usageMetadata.candidatesTokenCount}
- Total Tokens: ${response.usageMetadata.totalTokenCount}
- Thoughts Tokens: ${response.usageMetadata.thoughtsTokenCount}
- Model Response Time: ${modelResponseTime}s`,
      }),
      headers: {
        Authorization : `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) console.log("✅ Comment posted successfully.");
    else if (!res.ok) {
  const err = await res.text();
  throw new Error(`❌ Failed to post comment: ${res.status} ${res.statusText}\n${err}`);
}
  } catch (error) {
    console.error("Gemini error:", error);
    if (retry < maxRetry) {
      aiPRBot();
      retry++;
    } else {
      process.exit(1);
    }
  }
};
aiPRBot();
