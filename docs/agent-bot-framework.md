# Agent/Bot Framework

## Purpose

Chloris should evolve from an internal chat tool into an internal work automation platform.

The platform should allow team-built agents and bots to be added safely without giving them direct database access or cluttering every channel UI.

## Layers

```text
Chloris chat channels
  -> Agent Gateway
  -> Role agents
  -> Agent tools
  -> Internal bots / external bots / local worker adapters
  -> Audit logs and approvals
```

## Core Concepts

### Agent

An agent represents a job role or workflow owner.

Examples:
- Purchase Agent
- Payroll Agent
- Inventory Agent
- Customer Support Agent

Agents are installed per channel. Users mention agents naturally in chat.

### Tool

A tool is a capability an agent may call.

Examples:
- `purchase.structure_order_draft`
- `purchase.create_request`
- `purchase.enqueue_worker_task`
- `vendor.coupang.add_to_cart`
- `vendor.swadpia.prepare_order`

Tools should be explicitly declared and logged.

### Bot

A bot performs a concrete task. Bots can be:
- internal service
- local worker
- external webhook
- manual handoff adapter

Bots should usually appear under an agent, not as top-level channel clutter.

### Local Worker

A local worker performs browser/session-dependent work on a local Mac or PC.

Rules:
- no final payment automation
- no browser session secrets in repo docs
- worker receives tasks through API
- worker reports status and artifacts back to Chloris

### External App

External team-built apps must not access the DB directly.

Allowed integration patterns:
- webhook event delivery
- API token
- local worker task adapter

Tokens and secrets must be hashed or managed outside source-controlled docs.

## Registration Lifecycle

```text
draft -> submitted -> review -> active -> disabled -> revoked
```

Initial MVP can use admin-created records, but the data model and UI should move toward this lifecycle.

## Required Declarations

Every team-built agent/bot should declare:
- app type
- owner/team
- description
- supported events
- requested scopes
- required credentials
- configuration schema
- input schema
- output schema
- audit log target
- human approval requirements
- payment/data deletion/email restrictions

## Permissions

Default stance:
- no DB access
- no cross-channel access
- no production data deletion
- no real email sending
- no real payment
- no hidden background execution

Channel admins or system admins should install and enable apps per channel.

## Audit

All execution must be traceable:
- `AgentRun` for agent-level intent and result
- `AgentToolCall` for tools called by agents
- `BotEventLog` for bot/webhook execution
- `ApprovalRequest` for human approval decisions

## Purchase Agent Direction

Purchase Agent owns the purchase workflow.

Vendor bots should be child tools under Purchase Agent:
- Coupang Bot
- Sungwon Adpia Bot
- Gmarket Bot
- Hyundai Deco Bot

Users should not need to install every vendor bot separately in the channel UI. They should enable Purchase Agent, then configure which vendor tools are allowed.

## MVP Implementation Order

1. Keep current `AgentApp`, `AgentTool`, `BotApp`, and channel installation models.
2. Add capability/config conventions without major schema churn.
3. Add admin UI grouping:
   - installed agents
   - tools/bots under selected agent
   - channel config
   - vendor task status
4. Add external webhook skeleton only after Purchase Agent production testing is stable.
5. Add team app review lifecycle when at least one non-core team-built app is ready.
