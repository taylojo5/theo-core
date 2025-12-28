# Agent Engine Service

> **Status**: In Development (Phase 5)  
> **Last Updated**: December 2024

## Overview

The Agent Engine is the intelligent core of Theo, transforming simple chat into context-aware, action-capable assistance. It enables Theo to:

- Understand user intent from natural language
- Retrieve relevant context from all integrated sources
- Plan and execute multi-step actions
- Maintain complete auditability of all decisions
- Learn from user feedback over time

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT ENGINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    PERCEPTION LAYER                         │     │
│  │  User Input → Intent Analysis → Entity Extraction          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    REASONING LAYER                          │     │
│  │  Context Retrieval → Hypothesis Formation → Confidence     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    PLANNING LAYER                           │     │
│  │  Goal Decomposition → Step Sequencing → Dependency Graph   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    EXECUTION LAYER                          │     │
│  │  Tool Selection → Approval Check → Execution → Evaluation  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    AUDIT LAYER (Always On)                  │     │
│  │  Every decision, action, and outcome is logged             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration

The Agent Engine is configured via environment variables and the `config.ts` module.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | API key for LLM calls |
| `LLM_PROVIDER` | No | `openai` | LLM provider (`openai` or `anthropic`) |
| `LLM_MODEL_INTENTANALYSIS` | No | `gpt-4o-mini` | Model for intent analysis |
| `LLM_MODEL_PLANNING` | No | `gpt-4o` | Model for complex planning |
| `LLM_MODEL_TOOLSELECTION` | No | `gpt-4o` | Model for tool selection |
| `LLM_MODEL_RESPONSEGENERATION` | No | `gpt-4o` | Model for response generation |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_ENABLE_PLANNING` | `true` | Enable multi-step planning |
| `AGENT_ENABLE_PROACTIVE` | `false` | Enable proactive suggestions |
| `AGENT_ENABLE_LEARNING` | `false` | Enable learning from feedback |
| `AGENT_ENABLE_TOOLS` | `true` | Enable tool execution |
| `AGENT_ENABLE_AUDIT` | `true` | Enable audit logging |
| `AGENT_ENABLE_STREAMING` | `true` | Enable streaming responses |

### Confidence Thresholds

```typescript
// Configurable via environment variables (e.g., AGENT_CONFIDENCE_ACTION)
const CONFIDENCE_THRESHOLDS = {
  ACTION: 0.7,        // Min confidence to take action
  STATEMENT: 0.5,     // Min confidence for certain statements
  ASSUMPTION: 0.3,    // Min confidence to show assumptions
  HIGH_RISK: 0.9,     // Required for high-risk actions
  ENTITY_RESOLUTION: 0.8, // Required for entity matching
};
```

## Rate Limiting

The Agent Engine has specific rate limits to control costs and prevent abuse:

| Limit | Value | Purpose |
|-------|-------|---------|
| `agentChat` | 20/min | Chat messages per user |
| `agentActions` | 10/min | Tool executions per user |
| `llmTokens` | 100,000/hour | Token consumption per user |
| `agentExternal` | 50/hour | External API calls per user |
| `agentPlans` | 10/min | Plan creations per user |
| `agentApprovals` | 30/min | Approval actions per user |

## Safety Features

### Content Filtering

The Agent Engine includes robust content filtering for both input and output:

**Input Sanitization (`sanitizeInput`)**:
- Maximum length enforcement
- HTML/script tag removal
- Unicode normalization (prevents homograph attacks)
- Control character removal
- Prompt injection detection
- Harmful content detection

**Output Filtering (`filterOutput`)**:
- API key redaction
- Password pattern redaction
- System prompt leak detection
- Harmful content blocking

### Prompt Injection Detection

The system detects common prompt injection patterns:
- Instruction override attempts ("ignore previous instructions")
- Role manipulation ("pretend to be")
- Prompt extraction ("show me your system prompt")
- Jailbreak attempts ("DAN mode", "developer mode")
- Delimiter injection (`<|system|>`, `[INST]`)

Detected injections generate warnings but do not automatically block the request, as some patterns may be legitimate in context.

### Harmful Content Detection

Basic detection for:
- Violence/weapons
- Illegal activities
- Self-harm content
- Filter bypass attempts

For production use, integrate with a dedicated content moderation API (e.g., OpenAI Moderation API).

## File Structure

```
src/lib/agent/
├── config.ts              # Configuration and environment
├── safety/
│   ├── index.ts           # Safety module exports
│   └── content-filter.ts  # Input/output filtering
```

## Usage

### Validating Configuration

```typescript
import { validateAgentConfig, getAgentConfigSummary } from '@/lib/agent/config';

// Check required environment variables
const { valid, missing } = validateAgentConfig();
if (!valid) {
  console.error('Missing required env vars:', missing);
}

// Get full configuration summary
const config = getAgentConfigSummary();
console.log(config);
```

### Content Filtering

```typescript
import { sanitizeInput, filterOutput, isContentSafe } from '@/lib/agent/safety';

// Sanitize user input before processing
const result = sanitizeInput(userMessage);
if (!result.passed) {
  throw new Error(`Blocked: ${result.blockedReasons.join(', ')}`);
}

// Check if content is safe
if (!isContentSafe(content)) {
  return { error: 'Content not safe' };
}

// Filter agent output before sending to user
const filtered = filterOutput(agentResponse);
```

## Implementation Progress

- [x] **Chunk 0**: Security & Infrastructure Foundation
  - [x] Agent configuration module
  - [x] Rate limiting configuration
  - [x] Content filtering (input/output)
  - [x] Safety module structure
  - [x] Unit tests for content filter
- [ ] **Chunk 1**: Module Foundation (types, constants, logger, errors)
- [ ] **Chunk 2**: Database Models & Migrations
- [ ] **Chunk 3**: Audit Trail System
- [ ] ... (see PHASE_5_CHUNK_PLAN.md for full roadmap)

## Related Documentation

- [PHASE_5_AGENT_ENGINE.md](../build-docs/phase-5/PHASE_5_AGENT_ENGINE.md) - Phase 5 specification
- [PHASE_5_CHUNK_PLAN.md](../build-docs/phase-5/PHASE_5_CHUNK_PLAN.md) - Detailed implementation chunks
- [AGENTIC_FRAMEWORK.md](../AGENTIC_FRAMEWORK.md) - Architectural concepts and philosophy


