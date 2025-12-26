#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════════════════
// Queue Manager CLI
// Interactive CLI to view and manage BullMQ queues
// ═══════════════════════════════════════════════════════════════════════════

import { Queue } from "bullmq";
import Redis from "ioredis";
import * as readline from "readline";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const QUEUE_NAMES = {
  EMBEDDINGS: "embeddings",
  EMAIL_SYNC: "email-sync",
  CALENDAR_SYNC: "calendar-sync",
  NOTIFICATIONS: "notifications",
} as const;

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─────────────────────────────────────────────────────────────
// ANSI Colors
// ─────────────────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ─────────────────────────────────────────────────────────────
// Redis Connection
// ─────────────────────────────────────────────────────────────

let redis: Redis;

function createRedisClient(): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: false,
  });
}

// ─────────────────────────────────────────────────────────────
// Queue Utilities
// ─────────────────────────────────────────────────────────────

const queueCache = new Map<string, Queue>();

function getQueue(name: string): Queue {
  if (!queueCache.has(name)) {
    queueCache.set(
      name,
      new Queue(name, {
        connection: redis,
      })
    );
  }
  return queueCache.get(name)!;
}

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

async function getQueueStats(name: string): Promise<QueueStats> {
  const queue = getQueue(name);
  const [waiting, active, completed, failed, delayed, paused] =
    await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

  return { name, waiting, active, completed, failed, delayed, paused };
}

async function getAllQueueStats(): Promise<QueueStats[]> {
  const names = Object.values(QUEUE_NAMES);
  return Promise.all(names.map(getQueueStats));
}

async function drainQueue(name: string): Promise<number> {
  const queue = getQueue(name);
  const waiting = await queue.getWaiting();
  const delayed = await queue.getDelayed();

  let removed = 0;
  for (const job of [...waiting, ...delayed]) {
    try {
      await job.remove();
      removed++;
    } catch {
      // Job might have been picked up, ignore
    }
  }
  return removed;
}

async function obliterateQueue(name: string): Promise<void> {
  const queue = getQueue(name);
  await queue.obliterate({ force: true });
}

async function pauseQueue(name: string): Promise<void> {
  const queue = getQueue(name);
  await queue.pause();
}

async function resumeQueue(name: string): Promise<void> {
  const queue = getQueue(name);
  await queue.resume();
}

async function cleanQueue(name: string, grace: number = 0): Promise<number[]> {
  const queue = getQueue(name);
  const [completed, failed] = await Promise.all([
    queue.clean(grace, 1000, "completed"),
    queue.clean(grace, 1000, "failed"),
  ]);
  return [completed.length, failed.length];
}

async function retryFailedJobs(name: string): Promise<number> {
  const queue = getQueue(name);
  const failed = await queue.getFailed();
  let retried = 0;

  for (const job of failed) {
    try {
      await job.retry();
      retried++;
    } catch {
      // Job might not be retryable
    }
  }
  return retried;
}

// ─────────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────────

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function printHeader(): void {
  console.log("");
  console.log(c("bold", c("cyan", "╔═══════════════════════════════════════════════════════╗")));
  console.log(c("bold", c("cyan", "║           ") + c("white", "🔧 THEO Queue Manager") + c("cyan", "                    ║")));
  console.log(c("bold", c("cyan", "╚═══════════════════════════════════════════════════════╝")));
  console.log("");
}

function printQueueStats(stats: QueueStats[]): void {
  console.log(c("bold", "Queue Status:"));
  console.log(c("dim", "─".repeat(60)));

  const headers = ["Queue", "Waiting", "Active", "Delayed", "Completed", "Failed", "Status"];
  const widths = [16, 9, 8, 9, 11, 8, 10];

  // Print header
  let headerLine = "";
  headers.forEach((h, i) => {
    headerLine += c("bold", h.padEnd(widths[i]));
  });
  console.log(headerLine);
  console.log(c("dim", "─".repeat(60)));

  // Print rows
  stats.forEach((s) => {
    const statusColor = s.paused ? "yellow" : "green";
    const statusText = s.paused ? "⏸ Paused" : "▶ Active";

    const waitingColor = s.waiting > 0 ? "yellow" : "dim";
    const activeColor = s.active > 0 ? "cyan" : "dim";
    const delayedColor = s.delayed > 0 ? "blue" : "dim";
    const failedColor = s.failed > 0 ? "red" : "dim";

    let row = "";
    row += c("white", s.name.padEnd(widths[0]));
    row += c(waitingColor, String(s.waiting).padEnd(widths[1]));
    row += c(activeColor, String(s.active).padEnd(widths[2]));
    row += c(delayedColor, String(s.delayed).padEnd(widths[3]));
    row += c("dim", String(s.completed).padEnd(widths[4]));
    row += c(failedColor, String(s.failed).padEnd(widths[5]));
    row += c(statusColor, statusText);
    console.log(row);
  });
  console.log("");
}

function printMenu(): void {
  console.log(c("bold", "Actions:"));
  console.log(c("dim", "─".repeat(60)));
  console.log(`  ${c("cyan", "1")} - View queue details`);
  console.log(`  ${c("cyan", "2")} - Drain queue (remove waiting/delayed jobs)`);
  console.log(`  ${c("cyan", "3")} - Obliterate queue (remove ALL jobs)`);
  console.log(`  ${c("cyan", "4")} - Clean completed/failed jobs`);
  console.log(`  ${c("cyan", "5")} - Retry failed jobs`);
  console.log(`  ${c("cyan", "6")} - Pause queue`);
  console.log(`  ${c("cyan", "7")} - Resume queue`);
  console.log(`  ${c("cyan", "8")} - Drain ALL queues`);
  console.log(`  ${c("cyan", "9")} - Obliterate ALL queues`);
  console.log(`  ${c("cyan", "r")} - Refresh stats`);
  console.log(`  ${c("cyan", "q")} - Quit`);
  console.log("");
}

function printQueueSelector(): void {
  console.log(c("bold", "Select Queue:"));
  console.log(c("dim", "─".repeat(60)));
  Object.values(QUEUE_NAMES).forEach((name, i) => {
    console.log(`  ${c("cyan", String(i + 1))} - ${name}`);
  });
  console.log(`  ${c("cyan", "a")} - All queues`);
  console.log(`  ${c("cyan", "b")} - Back to menu`);
  console.log("");
}

async function printQueueDetails(name: string): Promise<void> {
  const queue = getQueue(name);
  const stats = await getQueueStats(name);

  console.log("");
  console.log(c("bold", `Queue: ${c("cyan", name)}`));
  console.log(c("dim", "─".repeat(60)));

  // Print stats
  console.log(`  Waiting:   ${c("yellow", String(stats.waiting))}`);
  console.log(`  Active:    ${c("cyan", String(stats.active))}`);
  console.log(`  Delayed:   ${c("blue", String(stats.delayed))}`);
  console.log(`  Completed: ${c("dim", String(stats.completed))}`);
  console.log(`  Failed:    ${c("red", String(stats.failed))}`);
  console.log(`  Status:    ${stats.paused ? c("yellow", "Paused") : c("green", "Active")}`);

  // Show recent jobs
  const [waiting, failed] = await Promise.all([
    queue.getWaiting(0, 4),
    queue.getFailed(0, 4),
  ]);

  if (waiting.length > 0) {
    console.log("");
    console.log(c("bold", "Recent Waiting Jobs:"));
    for (const job of waiting) {
      console.log(`  ${c("dim", `[${job.id}]`)} ${job.name} - ${c("dim", new Date(job.timestamp).toLocaleString())}`);
    }
  }

  if (failed.length > 0) {
    console.log("");
    console.log(c("bold", c("red", "Recent Failed Jobs:")));
    for (const job of failed) {
      const reason = job.failedReason?.slice(0, 50) || "Unknown";
      console.log(`  ${c("dim", `[${job.id}]`)} ${job.name}`);
      console.log(`    ${c("red", `↳ ${reason}`)}`);
    }
  }

  console.log("");
}

// ─────────────────────────────────────────────────────────────
// Interactive CLI
// ─────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function selectQueue(
  allowAll: boolean = false
): Promise<string[] | null> {
  printQueueSelector();
  const answer = await prompt(c("cyan", "→ "));

  if (answer === "b") return null;
  if (answer === "a" && allowAll) return Object.values(QUEUE_NAMES);

  const index = parseInt(answer) - 1;
  const names = Object.values(QUEUE_NAMES);
  if (index >= 0 && index < names.length) {
    return [names[index]];
  }

  console.log(c("red", "Invalid selection"));
  return null;
}

async function confirmAction(action: string): Promise<boolean> {
  const answer = await prompt(
    c("yellow", `⚠ Are you sure you want to ${action}? (y/N): `)
  );
  return answer === "y" || answer === "yes";
}

async function mainLoop(): Promise<void> {
  let running = true;

  while (running) {
    clearScreen();
    printHeader();

    const stats = await getAllQueueStats();
    printQueueStats(stats);
    printMenu();

    const action = await prompt(c("cyan", "→ Select action: "));

    switch (action) {
      case "1": {
        // View queue details
        clearScreen();
        printHeader();
        const queues = await selectQueue(false);
        if (queues) {
          await printQueueDetails(queues[0]);
          await prompt(c("dim", "Press Enter to continue..."));
        }
        break;
      }

      case "2": {
        // Drain queue
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          const queueList = queues.join(", ");
          if (await confirmAction(`drain ${queueList}`)) {
            for (const name of queues) {
              const removed = await drainQueue(name);
              console.log(
                c("green", `✓ ${name}: Drained ${removed} jobs`)
              );
            }
            await prompt(c("dim", "\nPress Enter to continue..."));
          }
        }
        break;
      }

      case "3": {
        // Obliterate queue
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          const queueList = queues.join(", ");
          console.log(
            c("red", "\n⚠ DANGER: This will remove ALL jobs including active, completed, and failed!\n")
          );
          if (await confirmAction(`OBLITERATE ${queueList}`)) {
            for (const name of queues) {
              await obliterateQueue(name);
              console.log(c("green", `✓ ${name}: Obliterated`));
            }
            await prompt(c("dim", "\nPress Enter to continue..."));
          }
        }
        break;
      }

      case "4": {
        // Clean queue
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          for (const name of queues) {
            const [completed, failed] = await cleanQueue(name);
            console.log(
              c("green", `✓ ${name}: Cleaned ${completed} completed, ${failed} failed jobs`)
            );
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "5": {
        // Retry failed jobs
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          for (const name of queues) {
            const retried = await retryFailedJobs(name);
            console.log(
              c("green", `✓ ${name}: Retried ${retried} failed jobs`)
            );
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "6": {
        // Pause queue
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          for (const name of queues) {
            await pauseQueue(name);
            console.log(c("yellow", `⏸ ${name}: Paused`));
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "7": {
        // Resume queue
        clearScreen();
        printHeader();
        const queues = await selectQueue(true);
        if (queues) {
          for (const name of queues) {
            await resumeQueue(name);
            console.log(c("green", `▶ ${name}: Resumed`));
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "8": {
        // Drain all queues
        clearScreen();
        printHeader();
        if (await confirmAction("drain ALL queues")) {
          for (const name of Object.values(QUEUE_NAMES)) {
            const removed = await drainQueue(name);
            console.log(c("green", `✓ ${name}: Drained ${removed} jobs`));
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "9": {
        // Obliterate all queues
        clearScreen();
        printHeader();
        console.log(
          c("red", "\n⚠ DANGER: This will remove ALL jobs from ALL queues!\n")
        );
        if (await confirmAction("OBLITERATE ALL queues")) {
          for (const name of Object.values(QUEUE_NAMES)) {
            await obliterateQueue(name);
            console.log(c("green", `✓ ${name}: Obliterated`));
          }
          await prompt(c("dim", "\nPress Enter to continue..."));
        }
        break;
      }

      case "r":
        // Refresh - just loop again
        break;

      case "q":
      case "quit":
      case "exit":
        running = false;
        break;

      default:
        // Unknown command, just refresh
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CLI Argument Handling
// ─────────────────────────────────────────────────────────────

async function runNonInteractive(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const queueArg = args[1];

  const validQueues = Object.values(QUEUE_NAMES);

  function getTargetQueues(arg: string | undefined): string[] {
    if (!arg || arg === "all") return validQueues;
    if (validQueues.includes(arg as QueueName)) return [arg];
    console.error(c("red", `Invalid queue: ${arg}`));
    console.error(`Valid queues: ${validQueues.join(", ")}, all`);
    process.exit(1);
  }

  switch (command) {
    case "status":
    case "stats": {
      const stats = await getAllQueueStats();
      printHeader();
      printQueueStats(stats);
      break;
    }

    case "drain": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        const removed = await drainQueue(name);
        console.log(c("green", `✓ ${name}: Drained ${removed} jobs`));
      }
      break;
    }

    case "obliterate": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        await obliterateQueue(name);
        console.log(c("green", `✓ ${name}: Obliterated`));
      }
      break;
    }

    case "clean": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        const [completed, failed] = await cleanQueue(name);
        console.log(
          c("green", `✓ ${name}: Cleaned ${completed} completed, ${failed} failed`)
        );
      }
      break;
    }

    case "pause": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        await pauseQueue(name);
        console.log(c("yellow", `⏸ ${name}: Paused`));
      }
      break;
    }

    case "resume": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        await resumeQueue(name);
        console.log(c("green", `▶ ${name}: Resumed`));
      }
      break;
    }

    case "retry": {
      const queues = getTargetQueues(queueArg);
      for (const name of queues) {
        const retried = await retryFailedJobs(name);
        console.log(c("green", `✓ ${name}: Retried ${retried} failed jobs`));
      }
      break;
    }

    case "help":
    case "--help":
    case "-h":
      printUsage();
      break;

    default:
      if (command) {
        console.error(c("red", `Unknown command: ${command}`));
        console.log("");
      }
      printUsage();
      break;
  }
}

function printUsage(): void {
  console.log(c("bold", "\nUsage:"));
  console.log("  npm run queue                    - Interactive mode");
  console.log("  npm run queue <command> [queue]  - Run command");
  console.log("");
  console.log(c("bold", "Commands:"));
  console.log("  status             Show all queue stats");
  console.log("  drain [queue]      Remove waiting/delayed jobs");
  console.log("  obliterate [queue] Remove ALL jobs (dangerous!)");
  console.log("  clean [queue]      Remove completed/failed jobs");
  console.log("  pause [queue]      Pause queue processing");
  console.log("  resume [queue]     Resume queue processing");
  console.log("  retry [queue]      Retry all failed jobs");
  console.log("  help               Show this help");
  console.log("");
  console.log(c("bold", "Queues:"));
  console.log(
    `  ${Object.values(QUEUE_NAMES).join(", ")}, all (default)`
  );
  console.log("");
  console.log(c("bold", "Examples:"));
  console.log("  npm run queue status");
  console.log("  npm run queue drain embeddings");
  console.log("  npm run queue drain all");
  console.log("  npm run queue obliterate email-sync");
  console.log("");
}

// ─────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // Connect to Redis
    redis = createRedisClient();

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      redis.once("ready", resolve);
      redis.once("error", reject);
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
    });

    console.log(c("dim", "Connected to Redis"));

    const hasArgs = process.argv.length > 2;

    if (hasArgs) {
      // Non-interactive mode
      await runNonInteractive();
    } else {
      // Interactive mode
      await mainLoop();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(c("red", `Error: ${error.message}`));
    } else {
      console.error(c("red", "An unknown error occurred"));
    }
    process.exit(1);
  } finally {
    // Cleanup
    rl.close();
    for (const queue of queueCache.values()) {
      await queue.close();
    }
    queueCache.clear();
    if (redis) {
      await redis.quit();
    }
    console.log(c("dim", "\nGoodbye! 👋"));
  }
}

main();


