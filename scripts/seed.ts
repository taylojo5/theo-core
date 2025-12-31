/**
 * Database Seed Script
 * Run with: npm run db:seed
 *
 * This script seeds the database with sample data for development.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@theo.app" },
    update: {},
    create: {
      email: "demo@theo.app",
      name: "Demo User",
      preferences: {
        timezone: "America/New_York",
        theme: "system",
      },
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create sample people
  const people = await Promise.all([
    prisma.person.upsert({
      where: {
        userId_email: { userId: user.id, email: "sarah@example.com" },
      },
      update: {},
      create: {
        userId: user.id,
        name: "Sarah Chen",
        email: "sarah@example.com",
        type: "colleague",
        importance: 8,
        company: "Acme Corp",
        title: "Product Manager",
        source: "manual",
        notes: "Met at the Q3 planning offsite. Very collaborative.",
        tags: ["work", "product"],
      },
    }),
    prisma.person.upsert({
      where: {
        userId_email: { userId: user.id, email: "mike@example.com" },
      },
      update: {},
      create: {
        userId: user.id,
        name: "Mike Johnson",
        email: "mike@example.com",
        type: "friend",
        importance: 7,
        source: "manual",
        notes: "College roommate. Lives in Seattle now.",
        tags: ["personal", "seattle"],
      },
    }),
  ]);

  console.log(`✅ Created ${people.length} people`);

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Review Q4 roadmap",
        description: "Go through the product roadmap and provide feedback",
        status: "pending",
        priority: "high",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        source: "manual",
        tags: ["work", "planning"],
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Prepare for Sarah's meeting",
        description: "Gather notes from last quarter's review",
        status: "pending",
        priority: "medium",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        source: "manual",
        tags: ["work", "meeting-prep"],
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: "Call Mike",
        description: "Catch up - haven't talked in a while",
        status: "pending",
        priority: "low",
        source: "manual",
        tags: ["personal"],
      },
    }),
  ]);

  console.log(`✅ Created ${tasks.length} tasks`);

  // Create a sample conversation
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: "Getting started with Theo",
      messages: {
        create: [
          {
            role: "system",
            content:
              "You are Theo, a thoughtful personal assistant. Be helpful, concise, and proactive.",
          },
          {
            role: "user",
            content: "Hi Theo! What can you help me with?",
          },
          {
            role: "assistant",
            content:
              "Hello! I'm Theo, your personal assistant. I can help you:\n\n• **Stay organized** - Track tasks, deadlines, and events\n• **Manage relationships** - Remember context about people in your life\n• **Connect services** - Integrate with Gmail, Slack, and more\n• **Take action** - Draft emails, schedule meetings, send messages\n\nWhat would you like to work on today?",
          },
        ],
      },
    },
    include: {
      messages: true,
    },
  });

  console.log(
    `✅ Created conversation with ${conversation.messages.length} messages`
  );

  // Create a sample audit log entry
  const auditLog = await prisma.auditLog.create({
    data: {
      userId: user.id,
      actionType: "create",
      actionCategory: "context",
      entityType: "person",
      entityId: people[0].id,
      intent: "User wanted to add a new contact",
      reasoning:
        "User provided name and email, created new person record with manual source",
      confidence: 0.95,
      inputSummary: "Add Sarah Chen as a colleague",
      outputSummary: "Created person record for Sarah Chen",
      status: "completed",
      completedAt: new Date(),
      durationMs: 45,
      assumptions: {
        create: [
          {
            assumption: "User wants to track this person as a work contact",
            category: "intent",
            evidence: { context: "User mentioned 'colleague'" },
            confidence: 0.9,
          },
        ],
      },
    },
    include: {
      assumptions: true,
    },
  });

  console.log(
    `✅ Created audit log with ${auditLog.assumptions.length} assumptions`
  );

  console.log("\n🎉 Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
