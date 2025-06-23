import { Plugin, TFile, Notice, requestUrl } from "obsidian";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { v4 as uuidv4 } from "uuid";

enum Importance {
  High = "High",
  Medium = "Medium",
  Low = "Low",
}

const IMPORTANCE_ORDER = {
  [Importance.High]: 3,
  [Importance.Medium]: 2,
  [Importance.Low]: 1,
};

interface Question {
  title: string;
  importance: Importance;
  estimatedTime?: number; // minutes
  startTime?: Date;
  timeSpent: number; // minutes
  completed: boolean;
}
interface ScrapbookSettings {
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
  importance?: Importance;
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
  questionsFilePath = "questions.md";

  async onload() {
    await this.loadSettings();
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
    console.log("Scrapbook plugin loaded");
  }

  async onLayoutReady() {
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
    if (await this.getCurrentQuestion()) {
      this.settings.timeSpent = this.calculateCurrentTimeSpent();
      await this.saveSettings();
    }
  }

  // === QUESTION MANAGEMENT ===

  async getQuestionsFileContent(): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(this.questionsFilePath);
    if (file instanceof TFile) {
      return this.app.vault.read(file);
    } else {
      console.log(
        "When finding questions, Questions file not found, creating new one..."
      );
      await this.createQuestionsFile();
      return this.getQuestionsFileContent();
    }
  }
  parseAdditionalFields(
    lines: string[],
    title: string,
    completed: boolean
  ): Question {
    let importance: Importance = Importance.Low;
    let estimatedTime: number | undefined = undefined;
    let startTime: Date | undefined = undefined;
    let timeSpent: number = 0;
    lines
      .flatMap((line) => line.split(", ").map((line) => line.trim()))
      .forEach((fieldLine) => {
        if (fieldLine.includes("Importance:")) {
          const parsedImportance = fieldLine.split("Importance:")[1].trim();
          if (parsedImportance in Importance) {
            importance = parsedImportance as Importance;
          }
        } else if (fieldLine.includes("Estimated:")) {
          const timeStr = fieldLine.split("Estimated:")[1].trim();
          estimatedTime = this.parseTimeString(timeStr);
        } else if (fieldLine.includes("Started:")) {
          const timeStr = fieldLine.split("Started:")[1].trim();
          startTime = new Date(timeStr);
        } else if (fieldLine.includes("Time Spent:")) {
          const timeStr = fieldLine.split("Time Spent:")[1].trim();
          timeSpent = this.parseTimeString(timeStr);
        }
      });
    return {
      title,
      importance,
      estimatedTime,
      startTime,
      timeSpent,
      completed,
    };
  }

  async getCurrentQuestion(): Promise<Question | null> {
    const content = await this.getQuestionsFileContent();
    const sections = content.split("## ");
    const activeSection = sections.find((section) =>
      section.startsWith("Active")
    );
    if (!activeSection) return null;
    const lines = activeSection
      .split("\n")
      .slice(1)
      .map((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith("- [")) {
        const completed = line.startsWith("- [x]"); // Check if user checked the question by hand
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        if (!titleMatch) continue;

        const title = titleMatch[1];
        return this.parseAdditionalFields(lines, title, completed);
      }
    }

    return null;
  }

  async getSectionQuestions(section: string): Promise<Question[]> {
    const questions: Question[] = [];
    const content = await this.getQuestionsFileContent();
    const sections = content.split("## ");
    const targetSection = sections.find((sec) => sec.startsWith(section));
    if (!targetSection) {
      console.log(`Section "${section}" not found in questions file.`);
      return questions;
    }
    const lines = targetSection
      .split("\n")
      .slice(1)
      .map((line) => line.trim());
    for (const line of lines) {
      if (line.startsWith("- [")) {
        const completed = line.startsWith("- [x]"); // Check if user checked the question by hand
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        if (!titleMatch) continue;
        questions.push(
          this.parseAdditionalFields([line], titleMatch[1], completed)
        );
      }
    }
    return questions;
  }

  async getPendingQuestions(): Promise<Question[]> {
    return await this.getSectionQuestions("Pending");
  }

  async getCompletedQuestions(): Promise<Question[]> {
    return await this.getSectionQuestions("Completed");
  }

  async getAllQuestions(): Promise<Question[]> {
    const questions: Question[] = await this.getPendingQuestions();
    questions.push(...(await this.getCompletedQuestions()));
    const activeQuestion = await this.getCurrentQuestion();
    if (activeQuestion) {
      questions.push(activeQuestion);
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

  async addQuestion(questionData: NewQuestionRequest) {
    const question: Question = {
      title: questionData.title,
      importance: questionData.importance || Importance.Low,
      estimatedTime: questionData.estimatedTime,
      timeSpent: 0,
      completed: false,
    };
    const activeQuestion = (await this.getCurrentQuestion()) || undefined;
    const restOfQuestions = [question];
    restOfQuestions.push(...(await this.getPendingQuestions()));
    restOfQuestions.push(...(await this.getCompletedQuestions()));
    await this.updateQuestionsFile(restOfQuestions, activeQuestion);
  }

  async completeCurrentQuestion() {
    const current = await this.getCurrentQuestion();
    if (!current) {
      this.notifyNoQuestion();
      return;
    }

    // Update time spent
    current.timeSpent = this.calculateCurrentTimeSpent();
    current.completed = true;

    // Clear current question
    this.settings.questionStartTime = undefined;
    this.settings.timeSpent = 0;

    await this.saveSettings();

    // Move to next question
    const pendingQuestions = await this.getPendingQuestions();
    let activeQuestion: Question | undefined = undefined;
    if (pendingQuestions.length > 0) {
      activeQuestion = pendingQuestions.shift()!;
    }
    pendingQuestions.push(current);
    const completedQuestions = await this.getCompletedQuestions();
    pendingQuestions.push(...completedQuestions);
    await this.updateQuestionsFile(pendingQuestions, activeQuestion);

    this.stopQuestionTimer();
    new Notice(`Question completed: ${current.title}`);
  }

  async onChangeQuestion(question: Question) {
    this.settings.questionStartTime = new Date().toISOString();
    this.settings.timeSpent = question.timeSpent;

    await this.saveSettings();

    if (!question.startTime) {
      question.startTime = new Date();
    }

    // Start timer
    this.startQuestionTimer();

    // Notify frontend
    this.notifyNewQuestion(question.title);
  }

  async notifyNoQuestion() {
    await this.notifyNewQuestion("No active question");
  }

  async notifyNewQuestion(questionTitle: string) {
    await this.notifyFrontend("/current-question", {
      question: {
        title: questionTitle,
      },
    });

    new Notice(`Started: ${questionTitle}`);
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

  async initializeTimers() {
    if ((await this.getCurrentQuestion()) && !this.settings.onBreak) {
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

  async checkOvertime() {
    const current = await this.getCurrentQuestion();
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
      const current = await this.getCurrentQuestion();
      if (current) {
        await this.notifyFrontend("/current-question", {
          question: {
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
- [ ] **Current Question Title**
- Importance: High
- Estimated: 2h
- Started: 2025-06-19 10:30
- Time Spent: 1h 23m
## Pending
- [ ] **Next Question** (Importance: Medium, Estimated: 1h)
- [ ] **Another Question** (Importance: Low, Estimated: 30m)
## Completed
- [x] **Previous Question** (Time Spent: 45m/1h)
`;
    await this.app.vault.create(this.questionsFilePath, content);
  }

  async updateQuestionsFile(questions: Question[], active?: Question) {
    const content = this.generateQuestionsMarkdown(questions, active);

    const file = this.app.vault.getAbstractFileByPath(this.questionsFilePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(this.questionsFilePath, content);
    }
    const updatedActive = await this.getCurrentQuestion();
    if (updatedActive) {
      this.onChangeQuestion(updatedActive);
    } else {
      this.notifyNoQuestion();
    }
  }

  generateQuestionsMarkdown(questions: Question[], active?: Question): string {
    const notCompleted = questions.filter((q) => !q.completed);
    const completed = questions.filter((q) => q.completed);

    if (notCompleted) {
      notCompleted.sort(
        (a, b) =>
          IMPORTANCE_ORDER[b.importance] - IMPORTANCE_ORDER[a.importance]
      );
      if (!active) {
        active = notCompleted.shift(); // Take the first one as active
      }
    }

    let content = "# Questions Queue\n\n## Active\n";

    if (active) {
      content += `- [ ] **${active.title}**\n`;
      content += `  - Importance: ${active.importance}\n`;
      if (active.estimatedTime)
        content += `  - Estimated: ${this.formatTimeString(
          active.estimatedTime
        )}\n`;
      if (active.startTime)
        content += `  - Started: ${active.startTime
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")}\n`;
      content += `  - Time Spent: ${this.formatTimeString(
        this.calculateCurrentTimeSpent()
      )}\n\n`;
    }

    content += "## Pending\n";
    notCompleted.forEach((q) => {
      content += `- [ ] **${q.title}**`;
      const details: Array<String> = [];
      details.push(`Importance: ${q.importance}`);
      if (q.estimatedTime)
        details.push(`Estimated: ${this.formatTimeString(q.estimatedTime)}`);
      if (details.length > 0) content += ` (${details.join(", ")})`;
      content += "\n";
    });

    content += "\n## Completed\n";
    completed.forEach((q) => {
      content += `- [x] **${q.title}**`;
      const details: Array<String> = [];
      if (q.timeSpent > 0)
        details.push(`Time Spent: ${this.formatTimeString(q.timeSpent)}`);
      if (q.estimatedTime)
        details.push(`Estimated: ${this.formatTimeString(q.estimatedTime)}`);
      if (details.length > 0) content += ` (${details.join(", ")})`;
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
    console.log("Starting Scrapbook API server...");
    this.server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        console.log(`Received request: ${req.method} ${req.url}`);
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

        this.handleAPIRequest(req, res, path);
      }
    );

    this.server.listen(this.settings.apiPort, () => {
      console.log(
        `Scrapbook API server running on port ${this.settings.apiPort}`
      );
    });
  }

  async handleAPIRequest(
    req: IncomingMessage,
    res: ServerResponse,
    path: string | null
  ) {
    try {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const data = JSON.parse(body);
            await this.handlePOSTRequest(path, data, res);
          } catch (error) {
            this.sendError(res, 400, "Invalid JSON");
          }
        });
      } else if (req.method === "GET") {
        await this.handleGETRequest(path, null, res);
      } else {
        this.sendError(res, 405, "Method not allowed");
      }
    } catch (error) {
      this.sendError(res, 500, "Internal server error");
    }
  }

  async handlePOSTRequest(path: string | null, data: any, res: ServerResponse) {
    switch (path) {
      case "/api/question/add":
        await this.addQuestion(data as NewQuestionRequest);
        this.sendSuccess(res, { message: "Question added" });
        break;

      case "/api/docs/add":
        await this.handleDocumentationRequest(data as DocumentationRequest);
        this.sendSuccess(res, { message: "Documentation added" });
        break;

      default:
        this.sendError(res, 404, "POST Endpoint not found");
    }
  }

  async handleGETRequest(path: string | null, data: any, res: ServerResponse) {
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

      case "/api/files":
        const files = this.getVaultFiles();
        this.sendSuccess(res, { files });
        break;

      default:
        this.sendError(res, 404, "GET Endpoint not found");
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
    console.error(`Error ${code}: ${message}`);
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
