# Scaler Clone Agent

A conversational CLI-based agent that behaves like a lightweight version of tools such as Cursor or Windsurf. It accepts natural language instructions directly in the terminal, reasons through them step by step, and generates actual output files on your local machine.

The primary use case demonstrated here is cloning the Scaler Academy website into a working frontend setup consisting of `index.html`, `style.css`, and `script.js`. The agent initially builds core sections such as the Header, Hero, and Footer, and then progressively refines the project across multiple interactions.

This project was developed as part of **Assignment 02 — AI Agent CLI Tool**.

---

## How to Try It Out (Demo)

1. Start the agent:

   ```bash
   npm start
   ```

2. At the prompt (`Entrée >`), enter:

   ```
   clone the scaler academy website into a folder called scaler_clone
   ```

3. Observe the agent’s reasoning loop in action. It will continuously cycle through THINK → TOOL → OBSERVE steps while planning and generating files.

4. Once complete, open:

   ```
   scaler_clone/index.html
   ```

   in your browser.

---

## Core Execution Loop

The agent operates using a strict, structured reasoning loop driven entirely by JSON messages. This ensures clarity, traceability, and multi-step problem solving.

```
   START
     │
     ▼
   THINK ◄─────────┐
     │             │
     ▼             │
   TOOL  ──►    OBSERVE
     │             │
     ▼             │
   THINK ──────────┘
     │
     ▼
   OUTPUT
```

At each step, the model produces exactly one JSON object describing its next action. For example:

```json
{ 
  "step": "TOOL", 
  "tool_name": "writeFile", 
  "tool_args": { 
    "path": "...", 
    "content": "..." 
  } 
}
```

### Execution Flow

* When a `TOOL` step is returned, the runner executes the corresponding JavaScript function.
* The result of that execution is fed back into the model as an `OBSERVE` message.
* The model continues iterating through THINK → TOOL → OBSERVE cycles.
* This continues until it emits an `OUTPUT` step, signaling completion.

Importantly, the full conversation history is preserved across prompts. This allows iterative refinement, such as:

> “Now add a testimonials section”

The agent will modify existing files rather than starting from scratch.

This loop is what enables true multi-step reasoning instead of single-pass code generation.

---

## Available Tools

The agent has access to a fixed set of tools for interacting with the system and filesystem:

| Tool              | Signature                             | Description                                                                        |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `executeCommand`  | `(cmd: string)`                       | Executes shell commands (e.g., `mkdir`, `ls`)                                      |
| `writeFile`       | `({ path: string, content: string })` | Writes a file, creating directories if necessary                                   |
| `readFile`        | `(path: string)`                      | Reads previously generated files for refinement                                    |
| `listFiles`       | `(path: string)`                      | Lists files within a directory                                                     |
| `fetchScalerSite` | `()`                                  | Fetches the Scaler homepage HTML (scripts/styles removed, truncated) for reference |

---

## Project Structure

```
.
├── index.js              # CLI agent, tool runner, and system prompt
├── package.json
├── .env.example          # Template for environment variables
├── .gitignore
├── README.md
└── scaler_clone/         # Generated output directory
    ├── index.html
    ├── style.css
    └── script.js
```

---

## Setup Instructions

Make sure you are using **Node.js 18 or higher**.

### Installation

```bash
npm install
cp .env.example .env
```

### Configure API Key

Open the `.env` file and add **one** API key. This project's demo was recorded using a Gemini API Key.

### Run the Agent

```bash
npm start
```

You will see:

* A banner indicating the active provider and model
* A prompt: `Entrée >`

Type your instruction and press Enter.

To exit the program:

```
exit
```

---

## Example Prompts

Here are some sample instructions you can give the agent:

* `add a hero section with a bold AI-focused headline and subtext like "Become the professional built for the next decade in AI" with a primary CTA button`
* `add a "Check your AI readiness score" interactive CTA section below the hero with a prominent button`
* `add a "Why Scaler" section with 4 feature cards (AI-integrated curriculum, AI-powered platform, lifelong learning access, strong foundations)`
* `add a "Find the AI path for your role" section with program cards for Software Engineering, Data Science, and DevOps including duration and ratings`
* `add a program details card with bullet points explaining what users will build (DSA, system design, AI projects)`
* `add a testimonials section with student quotes, roles, and company names in a clean card layout`
* `add a mentorship section with mentor cards including image, name, and company showing industry experts`
* `add a "How Scaler works" section with 5 steps (AI-first curriculum, mentorship, projects, mock interviews, community support)`
* `add a stats section showing outcomes like median CTC, salary hike %, and career transition rate`

These demonstrate how the agent can iteratively enhance the generated project.

---

## Implementation Details

A few important design decisions make the agent robust and reliable:

* **Strict JSON Output**
  All responses are requested in structured JSON format using:

  ```js
  response_format: { type: "json_object" }
  ```

  This ensures consistent parsing.

* **JSON Recovery Mechanism**
  If the model outputs malformed JSON (e.g., markdown fences or multiple objects), the runner:

  * Strips formatting
  * Extracts the first valid `{...}` block

* **Step Correction Logic**
  If the model mistakenly places the tool name inside the `step` field, the runner automatically corrects it to:

  ```json
  { "step": "TOOL", "tool_name": "..." }
  ```

* **Provider-Specific Token Limits**

  * Gemini: up to ~16K tokens
  * Groq: capped around ~4K tokens
    This prevents quota issues and ensures stable execution.

* **Original Code Generation Policy**
  When using `fetchScalerSite`, the agent is instructed to:

  * Use the fetched HTML strictly as a structural reference
  * Avoid copying any content verbatim
  * Generate fully original markup, styles, and scripts
