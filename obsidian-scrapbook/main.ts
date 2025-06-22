import { Plugin, TFile, Notice, requestUrl } from "obsidian";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { v4 as uuidv4 } from "uuid";

interface Question {
  id: string;
  title: string;
  importance: "High" | "Medium" | "Low";
  estimatedTime?: number; // minutes
  startTime?: Date;
  timeSpent: number; // minutes
  completed: boolean;
  createdAt: Date;
}

interface ScrapbookSettings {
  currentQuestionId?: string;
  questionStartTime?: string;
  timeSpent: number;
  frontendUrl: string;
  apiPort: number;
  lastThinkingMode?: string;
  onBreak: boolean;
}

interface DocumentationRequest {
  targetFile: string;
  text: string;
  image?: {
    data: string; // base64
    filename: string;
  };
}

interface NewQuestionRequest {
  title: string;
  importance?: "High" | "Medium" | "Low";
  estimatedTime?: number;
}

const DEFAULT_SETTINGS: ScrapbookSettings = {
  timeSpent: 0,
  frontendUrl: "http://localhost:5000",
  apiPort: 8080,
  onBreak: false,
};

export default class ScrapbookPlugin extends Plugin {
  settings: ScrapbookSettings;
  server: any;
  questionTimer: NodeJS.Timeout | null = null;
  thinkingModeTimer: NodeJS.Timeout | null = null;
  overtimeCheckTimer: NodeJS.Timeout | null = null;
  questions: Question[] = [];
  questionsFilePath = "questions.md";

  async onload() {
    await this.loadSettings();
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
    console.log("Scrapbook plugin loaded");
  }

  async onLayoutReady() {
    await this.loadQuestions();
    await this.startAPIServer();
    this.initializeTimers();
    this.scheduleThinkingMode();
    console.log("Scrapbook plugin layout ready");
  }

  async onunload() {
    this.stopAllTimers();
    if (this.server) {
      this.server.close();
    }
    await this.saveCurrentState();
    console.log("Scrapbook plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async saveCurrentState() {
    if (this.getCurrentQuestion()) {
      this.settings.timeSpent = this.calculateCurrentTimeSpent();
      await this.saveSettings();
    }
  }

  // === QUESTION MANAGEMENT ===

  async loadQuestions() {
    const file = this.app.vault.getAbstractFileByPath(this.questionsFilePath);
    if (file instanceof TFile) {
      const content = await this.app.vault.read(file);
      this.questions = this.parseQuestionsFromMarkdown(content);
    } else {
      // Create questions file if it doesn't exist
      await this.createQuestionsFile();
    }
  }

  parseQuestionsFromMarkdown(content: string): Question[] {
    const questions: Question[] = [];
    const lines = content.split("\n");
    let currentSection = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("## ")) {
        currentSection = line.substring(3).toLowerCase();
        continue;
      }

      if (line.startsWith("- [")) {
        const completed = line.startsWith("- [x]");
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        if (!titleMatch) continue;

        const title = titleMatch[1];
        const question: Question = {
          id: uuidv4(),
          title,
          importance: "Medium",
          timeSpent: 0,
          completed,
          createdAt: new Date(),
        };

        // Parse additional fields from subsequent lines
        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith("  - ")) {
          const fieldLine = lines[j].trim();
          if (fieldLine.includes("Importance:")) {
            const importance = fieldLine.split("Importance:")[1].trim() as
              | "High"
              | "Medium"
              | "Low";
            if (["High", "Medium", "Low"].includes(importance)) {
              question.importance = importance;
            }
          } else if (fieldLine.includes("Estimated:")) {
            const timeStr = fieldLine.split("Estimated:")[1].trim();
            question.estimatedTime = this.parseTimeString(timeStr);
          } else if (fieldLine.includes("Started:")) {
            const timeStr = fieldLine.split("Started:")[1].trim();
            question.startTime = new Date(timeStr);
          } else if (fieldLine.includes("Time Spent:")) {
            const timeStr = fieldLine.split("Time Spent:")[1].trim();
            question.timeSpent = this.parseTimeString(timeStr);
          }
          j++;
        }

        questions.push(question);
        i = j - 1;
      }
    }

    return questions;
  }

  parseTimeString(timeStr: string): number {
    // Parse formats like "2h", "30m", "1h 30m"
    let minutes = 0;
    const hourMatch = timeStr.match(/(\d+)h/);
    const minuteMatch = timeStr.match(/(\d+)m/);

    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minuteMatch) minutes += parseInt(minuteMatch[1]);

    return minutes;
  }

  formatTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0 && remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${remainingMinutes}m`;
    }
  }

  getCurrentQuestion(): Question | null {
    if (this.settings.currentQuestionId) {
      return (
        this.questions.find(
          (q) => q.id === this.settings.currentQuestionId && !q.completed
        ) || null
      );
    }
    return this.questions.find((q) => !q.completed) || null;
  }

  getNextQuestion(): Question | null {
    const current = this.getCurrentQuestion();
    const pending = this.questions.filter(
      (q) => !q.completed && q.id !== current?.id
    );

    // Sort by importance: High > Medium > Low
    const importanceOrder = { High: 3, Medium: 2, Low: 1 };
    return (
      pending.sort(
        (a, b) => importanceOrder[b.importance] - importanceOrder[a.importance]
      )[0] || null
    );
  }

  async addQuestion(questionData: NewQuestionRequest) {
    const question: Question = {
      id: uuidv4(),
      title: questionData.title,
      importance: questionData.importance || "Medium",
      estimatedTime: questionData.estimatedTime,
      timeSpent: 0,
      completed: false,
      createdAt: new Date(),
    };

    this.questions.push(question);
    await this.updateQuestionsFile();

    // If no current question, make this the current one
    if (!this.getCurrentQuestion()) {
      await this.setCurrentQuestion(question);
    }
  }

  async completeCurrentQuestion() {
    // Move to next question
    const next1 = this.getNextQuestion();
    if (next1) {
      await this.setCurrentQuestion(next1);
    }
    console.log(`Current question completed, moving to next: ${next1?.title}`);
    console.log("Completing current question...");
    const current = this.getCurrentQuestion();
    if (!current) return;

    // Update time spent
    current.timeSpent = this.calculateCurrentTimeSpent();
    current.completed = true;

    // Clear current question
    this.settings.currentQuestionId = undefined;
    this.settings.questionStartTime = undefined;
    this.settings.timeSpent = 0;

    await this.updateQuestionsFile();
    await this.saveSettings();

    // Move to next question
    const next = this.getNextQuestion();
    if (next) {
      await this.setCurrentQuestion(next);
    }

    this.stopQuestionTimer();
    new Notice(`Question completed: ${current.title}`);
  }

  async setCurrentQuestion(question: Question) {
    this.settings.currentQuestionId = question.id;
    this.settings.questionStartTime = new Date().toISOString();
    this.settings.timeSpent = question.timeSpent;

    question.startTime = new Date();

    await this.updateQuestionsFile();
    await this.saveSettings();

    // Start timer
    this.startQuestionTimer();

    // Notify frontend
    await this.notifyFrontend("/current-question", {
      question: {
        id: question.id,
        title: question.title,
        importance: question.importance,
        estimatedTime: question.estimatedTime,
      },
    });

    new Notice(`Started: ${question.title}`);
  }

  calculateCurrentTimeSpent(): number {
    if (!this.settings.questionStartTime) return this.settings.timeSpent;

    const startTime = new Date(this.settings.questionStartTime);
    const now = new Date();
    const sessionTime = Math.floor(
      (now.getTime() - startTime.getTime()) / (1000 * 60)
    );

    return this.settings.timeSpent + sessionTime;
  }

  // === TIMER MANAGEMENT ===

  initializeTimers() {
    if (this.getCurrentQuestion() && !this.settings.onBreak) {
      this.startQuestionTimer();
    }
  }

  startQuestionTimer() {
    this.stopQuestionTimer();

    this.questionTimer = setInterval(() => {
      if (!this.settings.onBreak) {
        this.checkOvertime();
      }
    }, 60000); // Check every minute

    // Check overtime every 5 minutes
    this.overtimeCheckTimer = setInterval(() => {
      if (!this.settings.onBreak) {
        this.checkOvertime();
      }
    }, 5 * 60000);
  }

  stopQuestionTimer() {
    if (this.questionTimer) {
      clearInterval(this.questionTimer);
      this.questionTimer = null;
    }
    if (this.overtimeCheckTimer) {
      clearInterval(this.overtimeCheckTimer);
      this.overtimeCheckTimer = null;
    }
  }

  checkOvertime() {
    const current = this.getCurrentQuestion();
    if (!current || !current.estimatedTime) return;

    const timeSpent = this.calculateCurrentTimeSpent();
    const threshold = current.estimatedTime * 1.4; // 40% over

    if (timeSpent > threshold) {
      this.notifyFrontend("/overtime-alert", {
        question: current.title,
        estimatedTime: current.estimatedTime,
        actualTime: timeSpent,
        overBy: timeSpent - current.estimatedTime,
      });
    }
  }

  scheduleThinkingMode() {
    // Schedule thinking mode every hour
    const scheduleNext = () => {
      const now = new Date();
      const nextHour = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours() + 1,
        0,
        0
      );
      const timeUntilNextHour = nextHour.getTime() - now.getTime();

      this.thinkingModeTimer = setTimeout(() => {
        this.startThinkingMode();
        scheduleNext(); // Schedule the next one
      }, timeUntilNextHour);
    };

    scheduleNext();
  }

  async startThinkingMode() {
    // Save current state
    await this.saveCurrentState();

    // Notify frontend
    await this.notifyFrontend("/thinking-mode", {
      message: "Thinking mode started",
      duration: 8, // minutes
    });

    new Notice("Thinking mode! Take 8 minutes to reflect.");

    // Resume after 8 minutes
    setTimeout(async () => {
      new Notice("Thinking mode complete. Back to work!");
      const current = this.getCurrentQuestion();
      if (current) {
        await this.notifyFrontend("/current-question", {
          question: {
            id: current.id,
            title: current.title,
            importance: current.importance,
            estimatedTime: current.estimatedTime,
          },
        });
      }
    }, 8 * 60 * 1000);
  }

  stopAllTimers() {
    this.stopQuestionTimer();
    if (this.thinkingModeTimer) {
      clearTimeout(this.thinkingModeTimer);
      this.thinkingModeTimer = null;
    }
  }

  // === FILE OPERATIONS ===

  async createQuestionsFile() {
    const content = `# Questions Queue

## Active

## Pending

## Completed
`;
    await this.app.vault.create(this.questionsFilePath, content);
  }

  async updateQuestionsFile() {
    const content = this.generateQuestionsMarkdown();

    const file = this.app.vault.getAbstractFileByPath(this.questionsFilePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(this.questionsFilePath, content);
    }
  }

  generateQuestionsMarkdown(): string {
    const active = this.questions.filter(
      (q) => !q.completed && q.id === this.settings.currentQuestionId
    );
    const pending = this.questions.filter(
      (q) => !q.completed && q.id !== this.settings.currentQuestionId
    );
    const completed = this.questions.filter((q) => q.completed);

    // Sort by importance
    const importanceOrder = { High: 3, Medium: 2, Low: 1 };
    pending.sort(
      (a, b) => importanceOrder[b.importance] - importanceOrder[a.importance]
    );

    let content = "# Questions Queue\n\n## Active\n";

    active.forEach((q) => {
      content += `- [ ] **${q.title}**\n`;
      content += `  - Importance: ${q.importance}\n`;
      if (q.estimatedTime)
        content += `  - Estimated: ${this.formatTimeString(q.estimatedTime)}\n`;
      if (q.startTime)
        content += `  - Started: ${q.startTime
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")}\n`;
      content += `  - Time Spent: ${this.formatTimeString(
        this.calculateCurrentTimeSpent()
      )}\n\n`;
    });

    content += "## Pending\n";
    pending.forEach((q) => {
      content += `- [ ] **${q.title}**`;
      const details: Array<String> = [];
      details.push(`Importance: ${q.importance}`);
      if (q.estimatedTime)
        details.push(`Est: ${this.formatTimeString(q.estimatedTime)}`);
      if (details.length > 0) content += ` (${details.join(", ")})`;
      content += "\n";
    });

    content += "\n## Completed\n";
    completed.forEach((q) => {
      content += `- [x] **${q.title}**`;
      const details: Array<String> = [];
      if (q.timeSpent > 0)
        details.push(`Time: ${this.formatTimeString(q.timeSpent)}`);
      if (q.estimatedTime)
        details.push(`${this.formatTimeString(q.estimatedTime)}`);
      if (details.length > 0) content += ` (${details.join("/")})`;
      content += "\n";
    });

    return content;
  }

  getVaultFiles(): string[] {
    const files = this.app.vault.getMarkdownFiles();
    return files.map((file) => file.path);
  }

  async appendToFile(targetFile: string, content: string) {
    const file = this.app.vault.getAbstractFileByPath(targetFile);

    if (file instanceof TFile) {
      const existingContent = await this.app.vault.read(file);
      const newContent = existingContent + "\n\n" + content;
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.create(targetFile, content);
    }
  }

  async saveImage(imageData: string, filename: string): Promise<string> {
    // Create attachments folder if it doesn't exist
    const attachmentsFolder = "attachments";
    if (!this.app.vault.getAbstractFileByPath(attachmentsFolder)) {
      await this.app.vault.createFolder(attachmentsFolder);
    }

    // Convert base64 to array buffer
    const binaryString = atob(imageData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imagePath = `${attachmentsFolder}/${filename}`;
    await this.app.vault.createBinary(imagePath, bytes.buffer);

    return imagePath;
  }

  // === API SERVER ===

  async startAPIServer() {
    this.server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        // Enable CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        const parsedUrl = parse(req.url || "", true);
        const path = parsedUrl.pathname;

        try {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const data = JSON.parse(body);
                await this.handleAPIRequest(path, data, res);
              } catch (error) {
                this.sendError(res, 400, "Invalid JSON");
              }
            });
          } else if (req.method === "GET") {
            await this.handleAPIRequest(path, null, res);
          } else {
            this.sendError(res, 405, "Method not allowed");
          }
        } catch (error) {
          console.error("API Error:", error);
          this.sendError(res, 500, "Internal server error");
        }
      }
    );

    this.server.listen(this.settings.apiPort, () => {
      console.log(
        `Scrapbook API server running on port ${this.settings.apiPort}`
      );
    });
  }

  async handleAPIRequest(path: string | null, data: any, res: ServerResponse) {
    switch (path) {
      case "/api/question/complete":
        await this.completeCurrentQuestion();
        this.sendSuccess(res, { message: "Question completed" });
        break;

      case "/api/break/start":
        this.settings.onBreak = true;
        await this.saveCurrentState();
        await this.saveSettings();
        this.sendSuccess(res, { message: "Break started" });
        break;

      case "/api/break/end":
        this.settings.onBreak = false;
        this.settings.questionStartTime = new Date().toISOString();
        await this.saveSettings();
        this.startQuestionTimer();
        this.sendSuccess(res, { message: "Break ended" });
        break;

      case "/api/question/add":
        await this.addQuestion(data as NewQuestionRequest);
        this.sendSuccess(res, { message: "Question added" });
        break;

      case "/api/files":
        const files = this.getVaultFiles();
        this.sendSuccess(res, { files });
        break;

      case "/api/docs/add":
        await this.handleDocumentationRequest(data as DocumentationRequest);
        this.sendSuccess(res, { message: "Documentation added" });
        break;

      default:
        this.sendError(res, 404, "Endpoint not found");
    }
  }

  async handleDocumentationRequest(docReq: DocumentationRequest) {
    let content = docReq.text;

    if (docReq.image) {
      const imagePath = await this.saveImage(
        docReq.image.data,
        docReq.image.filename
      );
      content = `![[${imagePath}]]\n\n${content}`;
    }

    await this.appendToFile(docReq.targetFile, content);
    new Notice(`Added to ${docReq.targetFile}`);
  }

  sendSuccess(res: ServerResponse, data: any) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, ...data }));
  }

  sendError(res: ServerResponse, code: number, message: string) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: message }));
  }

  async notifyFrontend(endpoint: string, data: any) {
    try {
      await requestUrl({
        url: `${this.settings.frontendUrl}${endpoint}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to notify frontend:", error);
    }
  }
}
