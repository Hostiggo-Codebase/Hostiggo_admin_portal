# Hostiggo Admin Portal & Mobile App Integration Summary

## 📌 1. Project Overview & Objective
The goal was to connect the **Hostiggo Admin Portal Supabase Database** (Primary DB) with the **Production/Mobile App Supabase Database** (Secondary DB: `vbqwitfzrglqojiijtmu.supabase.co`) so that support agents can manage mobile app tickets and chat in real-time with app users without page refreshes.

A standalone **React Native Expo App** was created in `./dummy_mobile_app` to simulate user ticket creation, ticket status tracking, and live chat.

---

## 🏗️ 2. Architecture & Multi-Database Integration

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       Hostiggo Admin Portal          │       │           Dummy Mobile App           │
│         (Port 3000 / Next.js)        │       │       (Port 8081 / Expo React Native)│
└──────────────────┬───────────────────┘       └──────────────────┬───────────────────┘
                   │                                              │
                   ▼                                              ▼
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│         Primary Supabase DB          │       │         Secondary Supabase DB        │
│        (Hostiggo Admin Portal)       │◄─────►│    (vbqwitfzrglqojiijtmu.supabase.co) │
│   - fdw_support_tickets (View)       │  FDW  │   - support_tickets (Table)          │
│   - fdw_chat_messages (View)         │       │   - chat_messages (Table)            │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

- **Postgres FDW (Foreign Data Wrapper)**: Created `prod_db` schema in Primary DB linked via foreign server to Secondary DB.
- **Public Views**: Created `public.fdw_support_tickets` and `public.fdw_chat_messages` in Primary DB so PostgREST API can serve Secondary DB data over standard HTTP endpoints.
- **Dual-Client Service Layer**: Direct API fallback via `@supabase/supabase-js` `secondaryClient` for real-time WebSocket broadcasts and guaranteed multi-tenant message persistence.

---

## 🚨 3. Key Issues Encountered & Solutions

### ❌ Issue 1: Secondary App Tickets Not Visible in Admin Queue
- **Root Cause**: PostgREST hides non-`public` schemas (`prod_db`) by default, causing browser JS SDK calls to `prod_db.support_tickets` to fail.
- **Solution**: Created `public.fdw_support_tickets` view in migration `0011_public_fdw_views.sql` and built a unified `/api/queue` endpoint that merges, deduplicates, and orders local and FDW tickets on the server side.

---

### ❌ Issue 2: Google Sign-in Account Switcher & Logout Cache Bug
- **Root Cause**: Google OAuth cached account choice in browser profiles, skipping the account picker on subsequent logins.
- **Solution**: Added `prompt: 'select_account'` query parameter to `signInWithOAuth` in `config.ts` & `login/page.tsx`, and updated `/app/auth/signout/route.ts` to clear authentication cookies explicitly.

---

### ❌ Issue 3: Live Chat Messages Not Syncing Real-Time Between Admin & App
- **Root Cause**: Postgres FDW triggers do not cross database boundaries via WebSockets automatically. Admin UI listened only to Primary DB channels, while Mobile App listened only to Secondary DB channels.
- **Solution**:
  1. **Dual Channel Subscriptions**: Updated `useTicketChat.ts` to subscribe to both Primary & Secondary Supabase realtime WebSocket channels.
  2. **1.5-Second Live Polling Fallback**: Added a 1.5s live polling interval in both Admin Portal (`useTicketChat.ts`) and Mobile App (`index.tsx`).
  3. **Unified Endpoint**: Updated `/api/messages` to handle direct inserts into `secondaryClient` and trigger instant WebSocket broadcasts.

---

### ❌ Issue 4: Agent Capacity Limits & Inability to Take New Tickets
- **Root Cause**: DB constraint (`active_chat_count < 2`) limits agents to 2 active tickets. Without explicit ways to release slots, agents reached capacity and couldn't pick up new tickets.
- **Solution**:
  - Built `/api/tickets/action` route to handle status transitions for both local and FDW tickets.
  - Added prominent action buttons in `TicketSidePanel.tsx`:
    - 🟢 **`Mark Complete (Resolved)`**: Resolves ticket and decrements `active_chat_count`.
    - 🟡 **`Hold (Wait for User)`**: Puts ticket on hold and decrements `active_chat_count`.
    - ⚡ **`Take Ticket`**: Claims a queued ticket to start active review.

---

### ❌ Issue 5: Opening a Ticket Redirected Back to Queue (`/admin/tickets/[id]`)
- **Root Cause**: `/admin/tickets/[id]/page.tsx` used `.schema('prod_db').select('*, complaint_categories(name)')`. PostgREST rejected relational joins on views, returning `null` and triggering `if (!ticket) redirect('/admin/queue')`.
- **Solution**: Implemented a **3-Tier Failsafe Ticket Loader**:
  1. Tier 1: Query local `support_tickets` table.
  2. Tier 2: Query `fdw_support_tickets` view using plain `select('*')`.
  3. Tier 3: Direct fallback query to Secondary Supabase project (`secondaryClient`).

---

### ❌ Issue 6: Blank Chat Window on Mobile App Created Tickets
- **Root Cause**: Direct fallback `insert` in mobile app created a row in `support_tickets` but omitted inserting the initial message (`description`) into `chat_messages`.
- **Solution**:
  1. Updated `handleCreateTicket` in `dummy_mobile_app/src/app/index.tsx` to insert opening message into `chat_messages`.
  2. Updated `/api/messages` GET handler in Admin Portal to synthesize and persist opening description messages if `chat_messages` has 0 rows.

---

## 📁 4. Summary of Modified & Created Files

| File Path | Description |
| :--- | :--- |
| [supabase/migrations/0009_fdw_secondary_sync.sql](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/supabase/migrations/0009_fdw_secondary_sync.sql) | FDW foreign schema & server setup |
| [supabase/migrations/0011_public_fdw_views.sql](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/supabase/migrations/0011_public_fdw_views.sql) | Public views (`fdw_support_tickets`, `fdw_chat_messages`) |
| [src/app/api/queue/route.ts](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/app/api/queue/route.ts) | Server-side ticket queue aggregator |
| [src/app/api/messages/route.ts](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/app/api/messages/route.ts) | Unified GET & POST chat API with fallback synthesis |
| [src/app/api/tickets/action/route.ts](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/app/api/tickets/action/route.ts) | Ticket status & slot capacity action endpoint |
| [src/app/admin/tickets/[id]/page.tsx](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/app/admin/tickets/[id]/page.tsx) | 3-tier failsafe ticket detail view |
| [src/components/admin/ticket-side-panel.tsx](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/components/admin/ticket-side-panel.tsx) | Ticket action buttons (Complete, Hold, Take, Re-open) |
| [src/hooks/useTicketChat.ts](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/src/hooks/useTicketChat.ts) | Dual-channel WebSocket & 1.5s live polling chat hook |
| [dummy_mobile_app/src/app/index.tsx](file:///Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/dummy_mobile_app/src/app/index.tsx) | Standalone Expo dummy app with live chat & ticket creation |

---

## 🚀 5. How to Run & Test locally

### 1️⃣ Start Hostiggo Admin Portal
```bash
cd /Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal
npm run dev
```
- Open Admin Portal: `http://localhost:3000`

### 2️⃣ Start Dummy Mobile App
```bash
cd /Users/vinitgautam/Desktop/hostiggo/Hostiggo_admin_portal/dummy_mobile_app
npm run web
```
- Open Mobile App: `http://localhost:8081`

### 3️⃣ Test Workflow
1. Create a ticket in Mobile App (`http://localhost:8081`).
2. Go to Admin Portal Review Queue (`http://localhost:3000/admin/queue`).
3. Click **Take →** to open ticket.
4. Type messages in both windows — watch live bidirectional updates!
5. Click **Mark Complete (Resolved)** or **Hold (Wait for User)** to release slot and claim another ticket.
