import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import diff_extractor from "./diff_extractor.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  return res.json({
    message: "working perfectly",
  });
});

app.get("/diff_pull", async (req, res) => {
  const url = req.body.url;
  const diff = await diff_extractor(url);
  console.log(diff);

  const prompt = `
You are a senior software engineer performing an AI code review. Review the following GitHub Pull Request diff:
${diff.slice(0, 12000)}
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
  try {
    const start = Date.now();
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });
    console.log(response.text);
    
    const text = await JSON.parse(response.text);
    const end = Date.now();
    const modelResponseTime = (end - start) / 1000;
    console.log(response.text);
    console.log(text);
    
    let commentBody = `
${text.summary}

**Weaknesses:**  
${text.weaknesses}

**Suggestions:**
`;

for (let i = 0; i < text.suggestions.length; i++) {
  const s = text.suggestions[i];
  commentBody += `\n${i + 1}. **[${s.category.toUpperCase()}]** — ${s.issue}\n*Score: ${s.score}/5*\n`;
}

console.log(commentBody);

    const github_comment = await fetch(
      "https://api.github.com/repos/kshitij-singh06/Secure-wipe/issues/5/comments",
      {
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
          Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.json({
      response: text,
      modelVersion: response.modelVersion,
      promptTokenCount: response.usageMetadata.promptTokenCount,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
      totalTokenCount: response.usageMetadata.totalTokenCount,
      thoughtsTokenCount: response.usageMetadata.thoughtsTokenCount,
      modelResponseTime: modelResponseTime,
    //   github_comment,
    });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  return res.status(400).json({
    message: "internal server error ",
  });
});

app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
});
