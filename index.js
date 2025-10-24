import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import diff_extractor from "./diff_extractor.js";
import fs from "fs/promises";

dotenv.config();

const GITHUB_TOKEN = process.env.COMMENT_GITHUB_TOKEN;
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

const prompt = `You are an expert senior software engineer conducting a thorough code review. Analyze the provided git diff and provide comprehensive feedback covering:
${diffText}
**Review Focus Areas:**
1. **Language-Specific Best Practices**: First identify the programming language(s) in the diff, then apply language-specific idioms, conventions
2. **Security Issues**: SQL injection, XSS vulnerabilities, authentication/authorization flaws, sensitive data exposure, insecure dependencies, hardcoded secrets
3. **Performance**: Inefficient algorithms, memory leaks, unnecessary re-renders, N+1 queries, blocking operations, excessive API calls
4. **Code Quality**: Code duplication, excessive complexity, poor naming, missing documentation, overly long functions/files
5. **Maintainability**: Tight coupling, lack of modularity, insufficient test coverage, brittle code, unclear logic
6. **Style & Conventions**: Inconsistent formatting, naming conventions, project style guide violations
7. **Bugs & Edge Cases**: Logic errors, race conditions, null/undefined handling, boundary conditions

**Response Format:**
AI response should be in json format not as markdown but inside the json you can use markdowns to highlight, directly without any extra marking send as json so that its easy to parse using JSON.parse(). Always give JSON output through out the response.
Strictly Return output as json in below format and use Markdown inside the json strictly:
{
  "summary": "A concise sentences overview of the changes and overall code quality",
  "suggestions": [
    {
      "issue": "string describing only actionable issue, bug, or vulnerability",
      "severity": 1-5 (1=critical/blocking, 2=major, 3=moderate, 4=minor, 5=trivial),
      "codeSnippet": "small snippet of code always required to describing the issue, bug, or vulnerability"
      "category": "security" | "performance" | "readability" | "maintainability" | "style" | "other",
      "filePath": "The full file path from the diff (e.g., 'src/api/users.ts')",
      "lineNumber": The specific line number where the issue occurs (as integer, e.g., 45),
      "recommendation": "Specific, actionable advice on how to fix the issue"
    }
  ]
}

**Important for Line Numbers & File Paths:**
- Use the line number from the new file version (the '+' lines in the diff)
- For issues spanning multiple lines, reference the first/most relevant line only
- Each suggestion must have a valid filePath and lineNumber for GitHub commenting

**Severity Guidelines:**
- **1 (Critical)**: Security vulnerabilities, data loss risks, breaking changes, major bugs
- **2 (Major)**: Significant performance issues, violated best practices, poor error handling
- **3 (Moderate)**: Code smells, maintainability concerns, missing edge case handling
- **4 (Minor)**: Style inconsistencies, minor refactoring opportunities, documentation gaps
- **5 (Trivial)**: Nitpicks, optional improvements

**Review Principles:**
- Be constructive and specific in feedback
- Explain *why* something is an issue, not just *what*
- Provide concrete examples or code snippets in recommendations
- Focus on impactful issues over nitpicks
- Flag anything that could cause production issues
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

---

### 💡 **Suggestions**
`;

    for (let i = 0; i < text.suggestions.length; i++) {
      const s = text.suggestions[i];
      commentBody += `

#### ${i + 1}. **[${s.category.toUpperCase()}]** — ${s.issue}

> **Severity:** ${s.severity}/5  
> **File Path:** \`${s.filePath}\`  
> **Line Number:** ${s.lineNumber}

**Code Snippet:**  
\`\`\`
${s.codeSnippet || '// Code snippet not provided.'}
\`\`\`

**🛠 Recommendation:**  
${s.recommendation}

---
`;
    }

    console.log(commentBody, text);

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
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) console.log("✅ Comment posted successfully.");
    else if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `❌ Failed to post comment: ${res.status} ${res.statusText}\n${err}`
      );
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
