# AI PR Review Bot

A GitHub Action that automatically reviews pull requests using **Google Gemini AI**, analyzes the code quality, maintainability, potential bugs, and security vulnerabilities, and posts a structured review as a comment on the PR.  

This bot gives each PR a detailed evaluation in JSON format and provides actionable suggestions with severity scores.

## Features

- Automatically triggered on pull requests (`opened`, `synchronize`, `reopened`).
- Fetches the PR diff and analyzes it using **Google Gemini AI**.
- Provides:
  - Summary of code quality and style.
  - Notes on maintainability and readability.
  - List of actionable suggestions with severity scores.
- Posts a structured review comment directly on the PR.
- Supports internal PRs (from branches of the same repo) fully.
- Can be safely configured to review PRs from forks using `pull_request_target` (optional).

---

## Getting Started

### Prerequisites

1. Node.js v20 or later.
2. NPM installed.
3. Google Gemini API Key.
4. A GitHub repository where you want to run this bot.

---

### Installation

1. Clone the repository or add this workflow to your repo.
2. Create a `.env` file for local testing (optional):
   ```env
   GITHUB_TOKEN=<your-personal-access-token>
   GEMINI_API_KEY=<your-gemini-api-key>
   GITHUB_REPOSITORY=<owner/repo>
   GITHUB_EVENT_PATH=./event.json
   ```
3. Install dependencies:
    ```
    npm install
    ```

### Usage

The GitHub Action workflow is located at `.github/workflows/ai-review.yml`.

It triggers automatically on pull requests:
```
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

To run locally:

```
node index.js
```


The bot will:

1. Read the PR event payload from `GITHUB_EVENT_PATH`.

2. Fetch the PR diff using the GitHub API.

3. Send the diff to Google Gemini AI for review.

4. Parse the AI response and post a comment on the PR.
---
### Environment Variables / Secrets
| Variable            | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `GITHUB_TOKEN`      | GitHub token to post comments on PRs (use `secrets.GITHUB_TOKEN`). |
| `GEMINI_API_KEY`    | Your Google Gemini AI API key (`secrets.GEMINI_API_KEY`).          |
| `GITHUB_EVENT_PATH` | Path to the GitHub event payload (automatically set in Actions).   |
| `GITHUB_REPOSITORY` | Repository full name (`owner/repo`).                               |
| `GITHUB_API_URL`    | GitHub API URL (default: `https://api.github.com`).                |


Note: In production, always use GitHub secrets instead of hardcoding API keys.

# Contributing

### Contributions are welcome!

- Add support for more languages or frameworks.

- Improve diff extraction logic.

- Enhance AI prompt and scoring.