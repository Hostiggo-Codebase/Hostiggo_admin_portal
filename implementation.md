# CLAUDE CODE — IMPLEMENTATION SPEC
# Hostiggo Support & Complaint Chat System (Supabase)

> **Instructions for Claude Code:** This file is the single source of truth. Build exactly what is specified here. Where this file is silent, prefer the simplest solution consistent with the patterns below. Do NOT invent extra statuses, tables, or endpoints. Ask before deviating from the schema or the status machine.

---

## 0. Project Context

Hostiggo is a luxury property rental platform. This module is the **support chat + complaint resolution system** inside the Hostiggo admin portal. Users (guests/hosts) raise complaints as tickets; each ticket has a real-time chat thread; agents resolve them under a strict lifecycle with escalation to a Super Admin.

**Non-goals (do not build):** group/multi-agent chat on one ticket, AI auto-resolution, voice/video, public FAQ bot.

---

## 1. Tech Stack (fixed — do not substitute)

- **Supabase**: Postgres 15, Auth, Realtime (postgres_changes + Broadcast + Presence), Storage, Edge Functions, `pg_cron`
- **Next.js 14+ App Router**, TypeScript strict mode
- **@supabase/ssr** (server components / route handlers) + **supabase-js v2** (client)
- **Tailwind CSS + shadcn/ui**
- **TanStack Query** for data fetching; Realtime events invalidate queries
- **Zod** for all form/RPC input validation
- **Resend** for email (called only from Edge Functions)
- **Supabase CLI** for local dev; every schema change is a migration file in `supabase/migrations/`
- Generated DB types via `supabase gen types typescript --local > src/types/database.ts`

## 2. Repo Structure

```
hostiggo-support/
├── supabase/
│   ├── migrations/           # numbered SQL migrations (schema, triggers, RPCs, RLS, cron)
│   ├── functions/
│   │   ├── send-email/       # Resend dispatch, triggered by DB webhook on notifications
│   │   └── _shared/
│   └── seed.sql              # complaint_categories, demo users/agents
├── src/
│   ├── app/
│   │   ├── (user)/support/           # user-facing: raise complaint, my tickets, chat
│   │   └── admin/
│   │       ├── queue/                # ticket queue screen
│   │       ├── tickets/[id]/         # ticket detail: chat + side panel
│   │       ├── my-assigned/
│   │       └── analytics/
│   ├── components/           # chat pane, message bubble, status badge, queue table...
│   ├── lib/
│   │   ├── supabase/         # client.ts, server.ts (ssr), middleware.ts
│   │   └── services/
│   │       └── ticketService.ts   # ALL db calls go through here (service abstraction)
│   ├── hooks/                # useTicketChat, useAgentPresence, useNotifications
│   └── types/
└── ...
```

**Rule:** UI components NEVER call `supabase.from()` directly. Everything routes through `src/lib/services/*` so the data layer has exactly one seam.

## 3. Roles & Auth

Three roles, stored in Supabase Auth `app_metadata.role`: `user`, `agent`, `super_admin`.

| Role | Can |
|---|---|
| `user` | create tickets, chat on own tickets, reopen within 72h, rate resolution |
| `agent` | handle assigned chats (max **2** concurrent), chat, change status via RPC, internal notes, escalate |
| `super_admin` | read all chats (read-only unless assigned), final escalation authority, approve/reject refunds, manage agents/categories, view audit logs & analytics |

Escalation stops at Super Admin (two tiers). A Super Admin missing SLA is re-alerted, never escalated further.

## 4. Database Schema (migration 0001)

All tables get `created_at timestamptz default now()`, `updated_at timestamptz` (touch trigger). All PKs are UUIDs (`gen_random_uuid()`).

### 4.1 `complaint_categories`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | Payment, Booking, Property, Refund, Other (seed) |
| description | text | nullable |
| is_active | boolean | default true |

### 4.2 `admin_users`
Live agent state only. Shift schedules live in `admin_shifts`.
| column | type | notes |
|---|---|---|
| admin_id | uuid PK, FK → auth.users | |
| display_name | text | |
| role | text CHECK in ('ADMIN','SUPER_ADMIN') | |
| agent_status | text CHECK in ('ONLINE','OFFLINE','INACTIVE') | default 'OFFLINE' |
| accepting_new_chats | boolean | default false; auto-false within 15 min of shift end |
| active_chat_count | int | 0–2; maintained ONLY by assignment/release RPCs |
| last_action_at | timestamptz | drives 5-min inactivity timeout |

### 4.3 `admin_shifts`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| admin_id | uuid FK → admin_users | |
| shift_date | date | |
| shift_start | timestamptz | |
| shift_end | timestamptz | |
| status | text CHECK in ('SCHEDULED','ACTIVE','ENDED') | |

### 4.4 `support_tickets`
| column | type | notes |
|---|---|---|
| ticket_id | uuid PK | |
| ticket_number | text UNIQUE | `'HG' || nextval(seq)` e.g. HG10234, via trigger |
| user_id | uuid FK → auth.users | who raised it |
| assigned_agent_id | uuid FK → admin_users | nullable |
| category_id | uuid FK → complaint_categories | |
| booking_id | uuid | nullable, FK when bookings table lands |
| property_id | uuid | nullable |
| parent_ticket_id | uuid FK → support_tickets | reopen/descendant chain |
| subject | text | |
| description | text | |
| status | text | see status machine §5 |
| priority | int | 1 = highest; queue sort key |
| priority_label | text CHECK in ('Urgent','Payment-Refund','Booking Help','General') | |
| deferred_type | text CHECK in ('DEFERRED_TICKET','CALLBACK_REQUEST') | nullable |
| callback_phone | text | nullable |
| callback_slot | timestamptz | nullable |
| transfer_count | int default 0 | |
| transferred_from | uuid FK → admin_users | nullable |
| queued_at | timestamptz | queue tiebreaker |
| assigned_at | timestamptz | nullable |
| first_response_at | timestamptz | SLA: first agent message |
| last_user_activity | timestamptz | drives 15-min resume-vs-new window |
| disconnect_grace_expires_at | timestamptz | nullable |
| escalated_at / escalated_by | timestamptz / uuid | nullable |
| resolved_at | timestamptz | nullable |
| reopen_window_expires_at | timestamptz | resolved_at + 72h, set by trigger |
| closed_at | timestamptz | nullable |
| rating | int CHECK 1–5 | nullable |
| rating_comment | text | nullable |

Indexes: `(status, priority, queued_at)`, `assigned_agent_id`, `user_id`, `category_id`, `parent_ticket_id`.

### 4.5 `chat_messages`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid FK → support_tickets | |
| sender_id | uuid | **no hard FK** — validated by trigger |
| sender_type | varchar CHECK in ('user','agent','system') | disambiguates users vs admin_users |
| body | text | |
| is_internal_note | boolean default false | agent-only, hidden from users by RLS |
| read_at | timestamptz | nullable |

Indexes: `(ticket_id, created_at)`, `(ticket_id, sender_id, created_at)` (rate limit lookup).

### 4.6 `message_attachments`
id, message_id FK, file_url (Storage key), file_name, file_type, file_size int. Max 10 MB; allowed: jpg/png/webp/pdf/mp4 (enforced client-side + Storage policy).

### 4.7 `ticket_status_history`
id, ticket_id FK, changed_by uuid, from_status (nullable), to_status, note (nullable). **Written only by the status-machine trigger** — never by application code.

### 4.8 `notifications`
id, user_id (recipient), ticket_id nullable, type CHECK in ('NEW_MESSAGE','STATUS_CHANGE','ASSIGNED','ESCALATED','SHIFT_END','CALLBACK_DUE'), payload jsonb, is_read boolean default false.

### 4.9 `audit_logs`
id, admin_id FK, ticket_id FK nullable, action text (ESCALATED, REFUND_APPROVED, REFUND_REJECTED, STATUS_CHANGE, REASSIGNED, TRANSFERRED, MANUAL_ASSIGN), previous_value jsonb, new_value jsonb. **Written only inside RPCs, same transaction as the mutation.**

### 4.10 `status_transitions` (allow-list, seeded)
| from_status | to_status |
|---|---|
| NULL | QUEUED |
| NULL | DEFERRED |
| QUEUED | ASSIGNED |
| QUEUED | DEFERRED |
| ASSIGNED | ACTIVE |
| ASSIGNED | QUEUED  *(agent went offline before first message)* |
| ACTIVE | WAITING_ON_USER |
| WAITING_ON_USER | ACTIVE |
| ACTIVE | ESCALATED |
| ESCALATED | ACTIVE  *(sent back to agent)* |
| ESCALATED | RESOLVED |
| ACTIVE | RESOLVED |
| WAITING_ON_USER | RESOLVED |
| RESOLVED | CLOSED |
| RESOLVED | REOPENED |
| REOPENED | ASSIGNED |
| REOPENED | QUEUED |
| DEFERRED | QUEUED |

## 5. Status Machine (migration 0002)

`BEFORE UPDATE OF status ON support_tickets` trigger:
1. Look up `(OLD.status, NEW.status)` in `status_transitions`. Not found → `RAISE EXCEPTION 'invalid transition % -> %'`.
2. Set side-effect timestamps: `RESOLVED → resolved_at = now(), reopen_window_expires_at = now() + interval '72 hours'`; `CLOSED → closed_at`; `ESCALATED → escalated_at`; `ASSIGNED → assigned_at`.
3. `AFTER UPDATE` trigger inserts into `ticket_status_history`.

Canonical statuses: `QUEUED, ASSIGNED, ACTIVE, WAITING_ON_USER, ESCALATED, RESOLVED, CLOSED, REOPENED, DEFERRED`. No other status strings anywhere in the codebase.

## 6. Assignment Engine (migration 0003) — the critical RPC

```sql
create or replace function assign_next_ticket()
returns uuid
language plpgsql security definer as $$
declare v_ticket uuid; v_agent uuid;
begin
  -- pick oldest highest-priority queued/reopened ticket, skip locked rows
  select ticket_id into v_ticket
  from support_tickets
  where status in ('QUEUED','REOPENED')
  order by priority asc, queued_at asc
  for update skip locked
  limit 1;
  if v_ticket is null then return null; end if;

  -- pick an eligible agent, lock their row too
  select admin_id into v_agent
  from admin_users
  where agent_status = 'ONLINE'
    and accepting_new_chats
    and active_chat_count < 2
  order by active_chat_count asc, last_action_at asc
  for update skip locked
  limit 1;
  if v_agent is null then return null; end if;  -- stays QUEUED

  update support_tickets
     set status = 'ASSIGNED', assigned_agent_id = v_agent
   where ticket_id = v_ticket;
  update admin_users
     set active_chat_count = active_chat_count + 1
   where admin_id = v_agent;
  -- notification row for the agent
  insert into notifications (user_id, ticket_id, type, payload)
  values (v_agent, v_ticket, 'ASSIGNED', jsonb_build_object('ticket_id', v_ticket));
  return v_ticket;
end $$;
```

**Reopened-ticket preference:** before the generic pick, if the ticket has `parent_ticket_id` and the parent's last agent is eligible, assign to them (implement as a first attempt inside the same function).

**Invoke on:** ticket INSERT (AFTER trigger), agent slot release (RESOLVED/CLOSED/ESCALATED/transfer decrements `active_chat_count`, then calls it), agent presence → ONLINE / `accepting_new_chats` → true. Loop it until it returns null to drain the queue.

**Queue overflow (DEFERRED):** on ticket creation, if `count(*) where status='QUEUED'` ≥ `MAX_QUEUE` (config table, default 25), create with status `DEFERRED` and prompt the user client-side to choose deferred ticket vs. callback (`deferred_type`, `callback_phone`, `callback_slot`). pg_cron re-queues DEFERRED tickets when the queue drains below threshold.

## 7. Other RPCs (all `security definer`, all write `audit_logs` in-transaction, all validate the caller's role internally)

| RPC | Who | Does |
|---|---|---|
| `create_ticket(...)` | user | insert ticket + initial chat_message; overflow check → DEFERRED branch; else QUEUED + call assign_next_ticket() |
| `send_message(ticket_id, body, is_internal_note)` | user/agent | insert message; sets `first_response_at` if first agent msg; bumps `last_user_activity` / `last_action_at`; flips ASSIGNED → ACTIVE on first exchange |
| `change_status(ticket_id, new_status, note)` | agent/SA | guarded update (trigger validates) |
| `escalate_ticket(ticket_id, reason)` | agent | ACTIVE → ESCALATED, escalated_by, frees agent slot, notifies all Super Admins |
| `resolve_escalation(ticket_id, decision, note)` | SA only | REFUND_APPROVED / REFUND_REJECTED audit action; → RESOLVED or back → ACTIVE |
| `transfer_ticket(ticket_id, to_agent)` | agent/SA | shift-end handoff; increments transfer_count, sets transferred_from, system message in chat |
| `reopen_ticket(ticket_id, reason)` | user | only if `now() < reopen_window_expires_at`; → REOPENED, priority = 1, insert reason as message |
| `rate_ticket(ticket_id, rating, comment)` | user | only on RESOLVED/CLOSED own ticket |
| `set_agent_presence(status, accepting)` | agent | syncs Presence channel join/leave to `admin_users`; ONLINE → calls assign_next_ticket() |
| `heartbeat()` | agent | updates last_action_at |

**Duplicate prevention (P-dup):** `create_ticket` rejects if the user already has a non-CLOSED ticket with the same `category_id` + `booking_id`, returning the existing ticket instead.

## 8. Rate Limiting (migration 0004)

`BEFORE INSERT ON chat_messages` trigger: count sender's messages on this ticket in the last 60s; if ≥ 10 → `RAISE EXCEPTION 'RATE_LIMITED'`. Client catches and shows a cooldown toast.

## 9. pg_cron Jobs (migration 0005) — every 5 minutes unless noted

| Job | Logic |
|---|---|
| `auto_close_expired` | RESOLVED tickets past `reopen_window_expires_at` → CLOSED (+ system message + notification) |
| `inactivity_sweep` | ACTIVE tickets: agent `last_action_at` > 5 min → warn agent notification; > 10 min → free slot, re-queue ticket. User side: no `last_user_activity` for 5 min → WAITING_ON_USER + warning message |
| `disconnect_grace` | tickets with `disconnect_grace_expires_at < now()` → RESOLVED with system message (user never returned within 15-min window) |
| `shift_end_warning` | agents whose active shift ends within 15 min → `accepting_new_chats = false` + SHIFT_END notification; at shift end with active chats → prompt transfer |
| `requeue_deferred` | if QUEUED count < threshold, flip oldest DEFERRED (deferred_type = DEFERRED_TICKET) → QUEUED |
| `callback_due` | callback_slot within next 15 min → CALLBACK_DUE notification to available agent |

## 10. RLS Policies (migration 0006)

Enable RLS on every table. Helper: `auth.jwt() -> 'app_metadata' ->> 'role'`.

- **support_tickets:** user SELECT `user_id = auth.uid()`; agent SELECT `assigned_agent_id = auth.uid() OR status IN ('QUEUED','REOPENED')` (queue visibility); SA SELECT all. **No direct UPDATE/INSERT for anyone** — RPCs only.
- **chat_messages:** user SELECT own tickets AND `is_internal_note = false`; agent SELECT assigned tickets; SA SELECT all. INSERT only via `send_message` RPC.
- **notifications:** SELECT/UPDATE(is_read) own rows only.
- **audit_logs:** SA SELECT only. No client writes.
- **admin_users:** agent SELECT self; SA all. Presence updates via RPC only.
- **Storage bucket `ticket-attachments`:** path convention `{ticket_id}/{message_id}/{filename}`; policy mirrors chat_messages SELECT access.

Realtime respects RLS — internal notes never reach user clients over the wire.

## 11. Realtime Channels (frontend hooks)

| Hook | Channel | Mechanism |
|---|---|---|
| `useTicketChat(ticketId)` | `ticket:{id}` | postgres_changes INSERT on chat_messages, filter `ticket_id=eq.{id}`; invalidates TanStack Query cache |
| `useTypingIndicator(ticketId)` | `ticket:{id}:typing` | Broadcast (ephemeral) |
| `useAgentPresence()` | `agents:presence` | Presence; on join/leave call `set_agent_presence` |
| `useMyAssignments()` | `agent:{uid}` | postgres_changes UPDATE on support_tickets, filter `assigned_agent_id=eq.{uid}` |
| `useNotifications()` | `notif:{uid}` | postgres_changes INSERT on notifications, filter `user_id=eq.{uid}` |

**User disconnect handling:** on chat unmount/offline, client marks `disconnect_grace_expires_at = now() + 15 min` via RPC. If the user returns inside the window and `last_user_activity` is within 15 min, resume the same ticket; otherwise new chat.

## 12. Edge Function: `send-email`

Triggered by Supabase Database Webhook on `notifications` INSERT. Reads type → template (ticket created, status change, resolved w/ rating link) → Resend API. Never called from the client. Env: `RESEND_API_KEY`.

## 13. UI Screens (build in this order)

1. **User: Raise Complaint** — category select, priority, subject, description, attachments (Zod-validated), duplicate-ticket handling.
2. **User: My Tickets + Chat** — ticket list w/ status badges; chat pane (messages, attachments, typing, read receipts); reopen button while window open; rating prompt on RESOLVED.
3. **Admin: Queue** — table sorted by priority then age; SLA breach highlight (first_response_at null and age > target); filters: status/priority/category/agent; SA-only manual assign.
4. **Admin: Ticket Detail** — chat pane + side panel (user info, booking link, status controls, internal-note toggle, escalate button, transfer dialog).
5. **Admin: My Assigned** — agent's ≤ 2 active chats, presence toggle, shift countdown.
6. **SA: Escalations** — pending escalations, approve/reject refund with note.
7. **SA: Analytics** — avg resolution time, tickets by category, agent load, CSAT. **All figures computed live from source tables — never stored** (dashboard is a pure read layer; use `security_invoker` views).
8. **SA: Audit Log viewer.**

## 14. SLA Targets (config table `sla_targets`)

| priority_label | first response | resolution |
|---|---|---|
| Urgent | 5 min | 2 h |
| Payment-Refund | 10 min | 8 h |
| Booking Help | 15 min | 24 h |
| General | 30 min | 48 h |

Breach = highlighted row + notification. Super Admin SLA miss → re-alert (no further escalation tier).

## 15. Build Order & Definition of Done

| Milestone | Contents | Done when |
|---|---|---|
| M1 | Migrations 0001–0002 (schema + status machine), seed, generated types | `supabase db reset` clean; invalid transition test raises |
| M2 | Migration 0003 assignment RPC + triggers | script: 50 concurrent `create_ticket` calls, 3 agents → zero double-assignment, no agent > 2 |
| M3 | Chat: send_message RPC, rate-limit trigger, RLS 0004+0006, Realtime hooks | two browsers chat live; internal note invisible to user session |
| M4 | pg_cron 0005, escalation/transfer/reopen RPCs | reopen + auto-close pass with a shortened test window (e.g. 2 min) |
| M5 | UI screens 1–5 | agent works a ticket end-to-end |
| M6 | Notifications + send-email Edge Function + SLA | email received on resolve; SLA badge renders |
| M7 | Screens 6–8, analytics views | dashboards live-derived; audit trail complete for every sensitive action |

**Testing requirements:** pgTAP or SQL scripts for the status machine and assignment race; Vitest for `ticketService`; a concurrency test script (M2) checked into `/scripts`.

**Conventions:** UUIDs everywhere. All timestamps timestamptz. All money later stays derived, never stored computed. Every DB change is a numbered migration — no dashboard-only schema edits.