import "dotenv/config";
import axios from "axios";
import { OpenAI } from "openai";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const usingGemini = !!process.env.GEMINI_API_KEY;
const usingGroq = !usingGemini && !!process.env.GROQ_API_KEY;
const provider = usingGemini ? "Gemini" : usingGroq ? "Groq" : "OpenAI";

const client = new OpenAI({
  apiKey:
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY,
  baseURL: usingGemini
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : usingGroq
    ? "https://api.groq.com/openai/v1"
    : process.env.OPENAI_BASE_URL || undefined,
});

const MODEL =
  process.env.MODEL ||
  (usingGemini
    ? "gemini-2.5-flash"
    : usingGroq
    ? "llama-3.3-70b-versatile"
    : "gpt-4.1-mini");

function parseArgs(args) {
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return { _raw: args }; }
  }
  return args || {};
}

async function executeCommand(args) {
  const cmd = typeof args === "string" ? args : args?.cmd;
  if (!cmd) return "ERROR: no command provided";
  return new Promise((resolve) => {
    exec(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return resolve(`ERROR: ${err.message}\n${stderr || ""}`);
      resolve(stdout || stderr || `(command "${cmd}" finished with no output)`);
    });
  });
}

async function writeFile(args) {
  const a = parseArgs(args);
  const filePath = a.path || a.filePath;
  const content = a.content;
  if (!filePath || typeof content !== "string") {
    return "ERROR: writeFile needs { path, content }";
  }
  const abs = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return `Wrote ${content.length} chars to ${filePath}`;
}

async function readFile(args) {
  const filePath = typeof args === "string" ? args : args?.path || args?.filePath;
  if (!filePath) return "ERROR: readFile needs a path";
  const abs = path.resolve(process.cwd(), filePath);
  const data = await fs.readFile(abs, "utf8");
  return data.length > 8000 ? data.slice(0, 8000) + "\n...[truncated]" : data;
}

async function listFiles(args) {
  const dirPath = (typeof args === "string" ? args : args?.path) || ".";
  const abs = path.resolve(process.cwd(), dirPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  return entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join(", ");
}

async function fetchScalerSite() {
  const url = "https://www.scaler.com/";
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (agent-cli)" },
    timeout: 15000,
  });
  const cleaned = data
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 3000);
  return cleaned;
}

const tool_map = {
  executeCommand,
  writeFile,
  readFile,
  listFiles,
  fetchScalerSite,
};

const SYSTEM_PROMPT = `
You are a terminal coding agent. You operate in a strict loop:

START -> THINK -> TOOL -> OBSERVE -> THINK -> ... -> OUTPUT

You must perform EXACTLY one step per reply.

---

CORE BEHAVIOR:

- Always reason before acting.
- Break tasks into multiple THINK steps before using a tool.
- Do not jump to OUTPUT unless the task is fully complete.
- Maintain memory of previously written files and refine them instead of rewriting blindly.

---

TOOLS:

- executeCommand(cmd)
  Use ONLY for shell operations (mkdir, ls).
  NEVER write file content using shell.

- writeFile({path, content})
  Write a file.
  The content MUST always be the COMPLETE final file (no partial edits, no placeholders).

- readFile(path)
  Read an existing file before modifying it.

- listFiles(path)
  Inspect directory structure.

- fetchScalerSite()
  Fetch cleaned scaler.com homepage HTML.
  MUST be called before building a Scaler clone.

---

STRICT RULES:

- Reply with EXACTLY ONE valid JSON object.
- No explanations. No markdown. No extra text.
- "step" must be one of: "START", "THINK", "TOOL", "OUTPUT".
- Tool names go ONLY in "tool_name".
- After a TOOL step, STOP and wait for OBSERVE.
- Do NOT combine multiple actions in one response.

---

HARD CONSTRAINTS:

- Do NOT copy or paste HTML/CSS from fetched site.
- Use fetched content only as a STRUCTURAL reference.
- All code must be ORIGINAL.
- Do NOT generate stub or minimal files — always produce realistic, production-like code.

---

SCALER CLONE REQUIREMENTS (LIGHT THEME):

Design must follow a modern landing page structure similar to scaler.com:
AI-first messaging, programs, mentorship, testimonials, and structured learning sections.

---

COLORS:

- Background: #ffffff
- Alternate section: #f7f8fa
- Primary: #1f1d80
- Primary hover: #4f46e5
- Heading: #0f172a
- Body text: #475569
- Muted text: #94a3b8
- Border: #e5e7eb
- Footer: #0f172a (ONLY dark section)

---

TYPOGRAPHY:

- Font: Inter (Google Fonts)
- H1: ~3rem, weight 700, line-height 1.1
- H2: ~2rem, weight 600
- Body: 1rem, line-height 1.6

---

LAYOUT:

- Max width: 1200px
- Side padding: 24px
- Section spacing: 80px–120px

---

REQUIRED SECTIONS:

1. Header
   - Sticky, white background
   - Logo text "Scaler"
   - Nav: Programs, Courses, Resources, For Business
   - Login link
   - Primary CTA "Apply Now"
   - Mobile hamburger

2. Hero (AI-first)
   - 2-column layout (stack on mobile)
   - Badge/pill
   - Large headline with highlighted keyword
   - Subtext (2 lines)
   - Primary + secondary CTA
   - Right side illustration or styled card

3. AI Readiness CTA
   - Prominent call-to-action section

4. Trusted By
   - Row of company names/logos (grayscale)

5. Why Scaler
   - 4 feature cards:
     - AI-integrated curriculum
     - AI-powered platform
     - Lifelong access
     - Strong foundations

6. Programs Section
   - Cards for:
     - Software Engineering
     - Data Science
     - DevOps / AI roles
   - Each includes duration, rating, outcomes

7. Mentorship Section
   - Mentor cards (image, name, company)

8. How It Works
   - 4–6 steps:
     curriculum, mentorship, projects, practice, career support

9. Testimonials
   - Student quotes with role and company

10. Footer
   - Dark background
   - 4 columns (Programs, Company, Resources, Legal)
   - Social icons

---

COMPONENT RULES:

Buttons:
- Radius: 8px
- Padding: 12px 24px
- Weight: 600
- Primary: blue background + white text
- Secondary: outlined

Cards:
- White background
- Radius: 12px
- Shadow: 0 4px 20px rgba(15,23,42,0.06)
- Padding: 24–32px
- Hover: translateY(-4px)

---

RESPONSIVENESS:

Breakpoints:
- 1024px
- 768px
- 480px

Behavior:
- Hero stacks vertically
- Navbar becomes hamburger
- Cards collapse into single column

---

OUTPUT REQUIREMENTS:

- index.html: ~400+ lines
- style.css: ~500+ lines
- script.js must include:
  - Hamburger toggle
  - Smooth scrolling
  - IntersectionObserver fade-in animations

---

QUALITY EXPECTATIONS:

- Use semantic HTML (header, section, footer)
- Maintain consistent spacing and alignment
- Avoid inline styles
- Use reusable CSS classes
- Ensure strong visual hierarchy

---

JSON FORMAT:

{
  "step": "START | THINK | TOOL | OUTPUT",
  "content": "string",
  "tool_name": "string (TOOL only)",
  "tool_args": "string | object (TOOL only)"
}
`.trim();

function stripFences(s) {
  return s
    .replace(/^﻿/, "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractFirstJsonObject(s) {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

async function runAgent(userInput, history) {
  history.push({ role: "user", content: userInput });

  let parseFailures = 0;
  const MAX_PARSE_FAILURES = 3;

  while (true) {
    let response;
    try {
      response = await client.chat.completions.create({
        model: MODEL,
        messages: history,
        max_tokens: usingGemini ? 16384 : 4000,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      console.error(`\n[api error] ${err.message}`);
      if (err.status) console.error(`[status] ${err.status}`);
      return;
    }

    const raw = response.choices[0]?.message?.content || "";
    if (!raw.trim()) {
      console.error(`\n[empty response] finish_reason=${response.choices[0]?.finish_reason}\n`);
      return;
    }

    let parsed;
    const cleaned = stripFences(raw);
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const firstObj = extractFirstJsonObject(cleaned);
      if (firstObj) {
        try { parsed = JSON.parse(firstObj); } catch {}
      }
      if (!parsed) {
        parseFailures++;
        console.log(`[parse-fail #${parseFailures}] ${e.message}`);
        if (parseFailures >= MAX_PARSE_FAILURES) {
          console.error(`\n[giving up] model produced invalid JSON ${MAX_PARSE_FAILURES} times.\n`);
          return;
        }
        history.push({ role: "assistant", content: raw });
        history.push({
          role: "user",
          content: JSON.stringify({
            step: "OBSERVE",
            content: `Your last message was not valid JSON (${e.message}). Respond with EXACTLY ONE valid JSON object — no markdown fences, no prose. Escape newlines inside strings as \\n.`,
          }),
        });
        continue;
      }
    }
    parseFailures = 0;

    if (parsed.step && !["START", "THINK", "TOOL", "OUTPUT"].includes(parsed.step) && tool_map[parsed.step]) {
      console.log(`[fixup] rewriting step="${parsed.step}" -> step="TOOL"`);
      if (!parsed.tool_name) parsed.tool_name = parsed.step;
      parsed.step = "TOOL";
    }

    history.push({ role: "assistant", content: JSON.stringify(parsed) });

    const step = parsed.step;
    if (step === "START") {
      console.log(`\n[START] ${parsed.content}`);
      history.push({ role: "user", content: "Proceed with the next step." });
    } else if (step === "THINK") {
      console.log(`[THINK] ${parsed.content}`);
      history.push({ role: "user", content: "Proceed with the next step." });
    } else if (step === "TOOL") {
      const name = parsed.tool_name;
      const argPreview =
        typeof parsed.tool_args === "object"
          ? JSON.stringify(parsed.tool_args).slice(0, 100)
          : String(parsed.tool_args ?? "").slice(0, 100);
      console.log(`[TOOL ] ${name}(${argPreview}${argPreview.length >= 100 ? "..." : ""})`);

      let observation;
      if (!tool_map[name]) {
        observation = `Tool "${name}" is not available.`;
      } else {
        try {
          observation = await tool_map[name](parsed.tool_args);
        } catch (err) {
          observation = `Tool error: ${err.message}`;
        }
      }
      const obsStr = typeof observation === "string" ? observation : JSON.stringify(observation);
      const obsTrunc = obsStr.length > 8000 ? obsStr.slice(0, 8000) + "...[truncated]" : obsStr;
      const preview = obsTrunc.replace(/\s+/g, " ").slice(0, 160);
      console.log(`[OBS  ] ${preview}${obsTrunc.length > 160 ? "..." : ""}`);

      history.push({
        role: "user",
        content: JSON.stringify({ step: "OBSERVE", content: obsTrunc }),
      });
    } else if (step === "OUTPUT") {
      console.log(`\n[OUTPUT] ${parsed.content}\n`);
      return;
    } else {
      console.log(`[warn] unknown step "${step}"`);
      history.push({
        role: "user",
        content: JSON.stringify({
          step: "OBSERVE",
          content: `"step" must be one of: "START", "THINK", "TOOL", "OUTPUT". Resend with the correct step.`,
        }),
      });
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error("Missing API key. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in .env.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log(" Scaler Clone Agent — conversational CLI");
  console.log(` Provider: ${provider}   Model: ${MODEL}`);
  console.log(" Try: 'clone the scaler academy website into scaler_clone'");
  console.log(" Type 'exit' to quit.");
  console.log("=".repeat(60));

  const rl = readline.createInterface({ input, output });
  const history = [{ role: "system", content: SYSTEM_PROMPT }];

  while (true) {
    const userInput = (await rl.question("\nEntrée > ")).trim();
    if (!userInput) continue;
    if (["exit", "quit", ":q"].includes(userInput.toLowerCase())) {
      console.log("Bye.");
      rl.close();
      return;
    }
    try {
      await runAgent(userInput, history);
    } catch (err) {
      console.error(`\n[error] ${err.message}\n`);
    }
  }
}

main();
