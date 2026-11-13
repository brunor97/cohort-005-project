# Hosted in-app notification providers: comparison

## Question

Which hosted in-app notification providers fit Cadence (React Router v7 framework mode on a Node server, SQLite/Drizzle, selling video courses)? Cadence only needs in-app notifications, each sent to one user (no broadcasts). Email is handled elsewhere.

Hard constraints: hosted (no self-hosting), a usable free tier, and a Node/JS server SDK.
Nice to have: a ready-made React feed/inbox component that can be restyled or used headless, and the option to add more channels later.

Candidates: Knock, Novu Cloud, MagicBell, Courier, SuprSend. No others were added; none looked like a clearly better fit than these five.

## Method

- **Checked on:** 2026-11-13.
- **Sources:** primary only. That means official docs (fetched as the vendors' own `.md` / `llms.txt` doc exports where available), official pricing pages, and the npm registry (`npm view <pkg>`) for package names, versions and deprecation flags. Every claim below has its source URL inline.
- **Pricing:** read from each live pricing page on the check date. The one exception is **Knock**. Its pricing page (`knock.app/pricing`) was blocked from this environment (HTTP 403 from both the fetch tool and the corporate proxy), so Knock's figures are **not verified**. See [Unverified / caveats](#unverified--caveats).
- **Scope:** this is a neutral comparison. It does not recommend a provider.

npm versions on the check date: `@knocklabs/node` 1.41.1, `@knocklabs/react` 0.15.1, `@novu/api` 3.19.1, `@novu/react` 3.19.2, `@novu/framework` 2.14.0, `magicbell-js` 1.8.0, `@magicbell/react` 1.14.0, `@trycourier/courier` 10.0.0, `@trycourier/courier-react` 9.3.5, `@suprsend/node-sdk` 1.15.1, `@suprsend/react` 1.5.0, `@suprsend/react-core` 2.4.0.

Deprecated packages to avoid (deprecation messages are from npm):

| Deprecated package | Use instead |
| --- | --- |
| `@novu/node` | `@novu/api` |
| `@trycourier/react-inbox` | `@trycourier/courier-react` |
| `@suprsend/react-inbox` | `@suprsend/react` |

---

## Comparison table

| | **Knock** | **Novu Cloud** | **MagicBell** | **Courier** | **SuprSend** |
|---|---|---|---|---|---|
| **Free tier** | Not verified (pricing page blocked). Knock's own pages, seen only as search snippets, say Free = 10,000 messages/mo. Message logs kept 30 days; feed items kept indefinitely. | 10,000 workflow runs/mo, up to 3 team members, Dev + Prod environments, 24h activity-feed retention, 30-day inbox feed retention, Novu branding | 1,000 deliveries/mo, 1 project, unlimited team members and users | 10,000 sends/mo. Log retention 30 days. | 10,000 notifications/mo, unlimited team members. Inbox shows SuprSend branding. Log retention 30 days. |
| **What one unit is** | 1 message = 1 user × 1 channel | 1 workflow run per subscriber triggered | 1 delivery = 1 user × 1 channel | 1 send = 1 template to 1 recipient, however many channels | 1 notification = 1 user × 1 channel (opt-out failures not billed) |
| **Next paid tier** | Not verified ("Starter"; search snippet says $250/mo for 50k messages) | Pro: from $30/mo for 30k runs, then $1.20 per 1k | Startup: $249/mo for 50k deliveries, then $0.0025 each; 5 projects | Business: $0.005 per send, pay-as-you-go, counted from the first send | Essentials: $100/mo **billed annually** ($1,200/yr) for 50k, then $2 per 1k |
| **Node server SDK** | `@knocklabs/node`, `workflows.trigger(key, {recipients, data})` | `@novu/api`, `novu.trigger({workflowId, to:{subscriberId}, payload})` | `magicbell-js` (`/project-client`), `broadcasts.createBroadcast({recipients:[…], title, content})` | `@trycourier/courier`, `client.send.message({message:{to:{user_id}, template \| content, routing}})` | `@suprsend/node-sdk`, `workflows.trigger(new WorkflowTriggerRequest({workflow, recipients:[{distinct_id}], data}))` |
| **React inbox package** | `@knocklabs/react` (popover feed, inbox, toasts) | `@novu/react` (`<Inbox />`) | `@magicbell/react` (`Inbox`, `FloatingInbox`) | `@trycourier/courier-react` (`CourierInbox`, popup menu, toasts) | `@suprsend/react` (`<Inbox />`) |
| **Styling** | CSS variables (`--rnf-*`), replace the CSS entirely, render props, light/dark | `appearance` prop: `baseTheme`, `variables`, `elements` (Tailwind classes accepted), dark theme | Importable CSS; override `--magicbell-*` variables and classes; custom item component | `lightTheme` / `darkTheme` objects, `mode`, swap header and list items for your own components | `theme` object, `themeType` light/dark, CSS customisation |
| **Headless hooks** | Yes: `useNotifications`, `useNotificationStore` | Yes: `useNotifications`, `useCounts`, `useNovu` | Not in current `@magicbell/react` docs. The `magicbell-js` user client and Realtime work headless. A legacy `@magicbell/react-headless` package exists. | Yes: `useCourier()` | Yes: `@suprsend/react-core` (`useFeedClient`, `useFeedData`, `useFeed`) |
| **Recipient identity** | Inline identify on trigger, or upfront `users.identify`. Bulk identify also available. | Subscriber created on the fly from trigger data, or created upfront | Users upserted on the fly from `recipients` or when the inbox initialises | Stored profile (`user_id`), with inline contact details merged per send | Upfront identify (upsert by `distinct_id`), or inline user properties in the trigger |
| **Browser feed auth** | Public key + user id. "Enhanced security mode" adds an RS256-signed user JWT. Off by default; recommended for prod. | `applicationIdentifier` + `subscriberId`. Optional HMAC `subscriberHash` toggle. | User JWT (HS256, signed with project secret) is required | Scoped JWT minted server-side via `POST /auth/issue-token` is required | Public key + `distinctId`. "Enhanced security mode" adds an ES256-signed user JWT. Recommended for prod. |
| **Real-time** | WebSocket | WebSocket | WebSocket (`magicbell-js/realtime`) | WebSocket (`wss://realtime.courier.io`) | Socket, plus a reachability status API |
| **Templates** | Dashboard editor. CLI pulls and pushes workflows and templates as local files. Management API. | Dashboard editor, code-first Novu Framework (TypeScript), code steps, CLI sync | Content passed inline in each API call. Dashboard broadcasts. Workflow JSON definitions via API and CLI. | Design Studio in the dashboard. Templates API ("as code from Git, the CLI"). Inline Elemental `content` on send. | Dashboard templates and workflows. CLI pull/push/commit. Management API. |
| **Read states** | seen, read, interacted, archived, link_clicked. `markAllAsSeen`; mark all as read. | read/unread, seen, archived, snoozed. `readAll`, `seenAll`, `archiveAll`, `archiveAllRead`. | read/unread, seen, archived. `markAllNotificationsRead`, `archiveAllNotifications`. | read/unread, opened, clicked, archived. `readAllMessages`. | seen, read/unread, archived, interacted. `markAllAsRead`, `markBulkAsSeen`. |
| **Environments / testing** | Starts with Production only; you enable a Development environment and can add more. Sandbox mode (not available for in-app). Test runner. | Dev + Prod on Free. `npx novu dev` (Local mode through a tunnel). | 1 project on Free. Docs say to create separate projects for staging and prod. | Production + Test (up to 20 environments). Test env has a built-in email test provider. Test sends are billed. | Sandbox (trial), Staging and Production workspaces. Test Mode in Staging. |
| **Local / offline emulator** | None found | None for Cloud. `novu dev` still needs Novu Cloud. | None found | None found | None found |
| **Channels to add later** | Email, SMS, push, chat (Slack, Teams, Discord), webhook | Email, SMS, push, chat, plus "Tool" (PagerDuty and similar) | Email, SMS, mobile push, web push, Slack, Teams | Email, SMS, push, chat (Slack, Teams), and more | Email, SMS, WhatsApp, mobile and web push, Slack, Teams, webhook |

---

## Knock

**Free tier and pricing (NOT VERIFIED).** Knock's docs say there is a Free plan ("formerly known as our Developer plan") and two paid plans, Starter and Enterprise. They defer the actual figures to the pricing page ([docs: Knock plans](https://docs.knock.app/manage-your-account/knock-plans.md)). That page, `https://knock.app/pricing`, could not be fetched from this environment.

A web search restricted to `knock.app` returned snippets from Knock's own marketing/blog pages, e.g. [knock.app/blog/the-top-notification-infrastructure-platforms-for-developers](https://knock.app/blog/the-top-notification-infrastructure-platforms-for-developers). They say "free for up to 10,000 messages per month" and "Starter plan costs $250 per month, includes 50,000 messages (with $0.005 per message overages), and removes Knock branding". These figures are **unconfirmed against the live pricing page**.

What the docs do confirm:

- **How usage is metered:** "A message is counted each time a notification is successfully delivered to a single user on a single channel." Usage accrues in every environment ([docs: Knock plans](https://docs.knock.app/manage-your-account/knock-plans.md)).
- **Retention:**
  - Message logs, workflow run logs and audit logs: 30 days on non-Enterprise plans, 90 days on Enterprise.
  - API logs: 30 days on every plan.
  - "In-app feed notifications are available indefinitely" through the feeds API, even after the logs expire.
  - Source: [docs: data retention](https://docs.knock.app/manage-your-account/data-retention.md).

**Node SDK.** The package is `@knocklabs/node`:

```js
import Knock from '@knocklabs/node';
const client = new Knock({ apiKey: process.env.KNOCK_API_KEY });
await client.workflows.trigger('dinosaurs-loose', { recipients: ['dnedry'], data: { dinosaur: 'triceratops' } });
```

Source: [knock-node README](https://github.com/knocklabs/knock-node). The same package exports `signUserToken` for issuing the browser user tokens ([docs: security](https://docs.knock.app/in-app-ui/security-and-authentication.md)).

**React feed.** The package is `@knocklabs/react`. It ships pre-built feed, inbox and toast components ([docs: React overview](https://docs.knock.app/in-app-ui/react/overview.md)).

- **Styling** ([docs: feed styling](https://docs.knock.app/in-app-ui/feeds/styling.md)):
  - CSS variables prefixed `--rnf-`
  - Replace Knock's CSS completely (classes are prefixed `rnf-`)
  - Props such as `renderItem`, `Avatar`, `NotificationIconButton`, and `colorMode` (light/dark)
- **Headless** ([docs: headless feed](https://docs.knock.app/in-app-ui/react/headless/feed.md)):
  - Hooks: `useKnockClient`, `useNotifications`, `useNotificationStore`
  - In headless mode you are responsible for calling `feedClient.markAllAsSeen()` / `markAsSeen()`; the pre-built popover does this for you.
  - `@knocklabs/react-core` also exists on npm.

**Identity.** Recipients must be "identified" (stored in Knock) before they can be notified. There are three ways to do this ([docs: identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients.md)):

- Direct `identify`
- Bulk identify
- Inline identification, where recipient objects are included in the workflow trigger, or passed when initialising `KnockProvider` on the client. Knock "guarantees that recipients are identified before executing any other action".

**Browser authentication.** The browser uses a public API key. "Enhanced security mode" additionally requires a JWT signed with RS256 using the private signing key from the dashboard. The JWT carries a `sub` claim and optionally `iat`, `exp` and `grants` ([docs: security](https://docs.knock.app/in-app-ui/security-and-authentication.md)).

- The mode is "off by default, so you can build and test your in-app [feed] … Knock will not reject requests that do not include a signed user token".
- Knock recommends enabling it in production and keeping it off in development.

**Real-time.** "Clients connect to the in-app real-time service, which receives notifications over a websocket" ([docs: feeds overview](https://docs.knock.app/in-app-ui/feeds/overview.md)). Socket behaviour can be overridden ([docs index](https://docs.knock.app/llms.txt)).

**Templates.**

- In-app content is authored in the Knock template editor as part of a workflow ([docs: feeds overview](https://docs.knock.app/in-app-ui/feeds/overview.md)).
- The Knock CLI (`npm install -g @knocklabs/cli`) can "pull Knock workflows down to your local machine and work with your notification logic and templates in your code editor". It also handles CI/CD and promoting changes between environments ([docs: CLI](https://docs.knock.app/developer-tools/knock-cli.md)).
- A Management API is also available ([docs: Knock plans](https://docs.knock.app/manage-your-account/knock-plans.md)).

**Read state.**

- Engagement statuses are `seen`, `read`, `interacted`, `link_clicked` and `archived`. They are not mutually exclusive ([docs: message statuses](https://docs.knock.app/send-notifications/message-statuses.md)).
- The feed API can filter by unread, read, seen and archived. It returns `unseen_count` and unread counts, and excludes archived items by default ([docs: in-app API overview](https://docs.knock.app/in-app-ui/api-overview.md)).
- "Mark all as read" bulk-updates statuses ([docs: message statuses](https://docs.knock.app/send-notifications/message-statuses.md)). `markAllAsSeen` is on the feed client ([docs: headless feed](https://docs.knock.app/in-app-ui/react/headless/feed.md)).

**Local dev / tests.**

- **Environments:** an account "starts with a single environment: production". Enabling environments adds Development, and you can create more (e.g. staging). Each environment has isolated data and version-controlled content ([docs: environments](https://docs.knock.app/version-control/environments.md)).
- **Sandbox mode:** messages are rendered but not delivered, and don't count toward usage. However, "the in-app channel doesn't support sandbox mode". For in-app, Knock recommends channel conditions instead ([docs: Knock plans](https://docs.knock.app/manage-your-account/knock-plans.md)).
- **Test runner:** available ([docs: testing workflows](https://docs.knock.app/send-notifications/testing-workflows.md)).
- **No local emulator** or offline transport was found in the docs.

**Channels.** Email, push, SMS, chat (Slack, Microsoft Teams, Discord) and webhook ([docs: integrations overview](https://docs.knock.app/integrations/overview.md)).

---

## Novu Cloud

**Free tier.** From the [pricing page](https://novu.co/pricing):

- 10,000 workflow runs per month
- All channels
- 2 environments (Dev + Prod)
- Activity feed retention: 24 hours
- Up to 3 team members
- The plan comparison table also shows, for Free: 30-day inbox feed retention, a workflow limit of 5, unlimited subscribers, and Novu branding (removing it starts at Pro).
- A "workflow run is one execution of a workflow. Triggering a workflow to a single subscriber counts as 1 run" ([pricing FAQ](https://novu.co/pricing)).

**Next tier.** Pro, "from $30/month" ([pricing](https://novu.co/pricing)):

- 30,000+ runs, then $1.20 per 1,000 extra
- 7-day activity-feed retention
- Removes Novu branding
- The table also shows a workflow limit of 20 and 90-day inbox feed retention.
- The overview cards say team members are unlimited on Pro, but the comparison table shows 3. These two disagree.

**Node SDK.** The package is `@novu/api`. Docs list it as the official TypeScript/Node.js SDK ([docs: trigger workflow](https://docs.novu.co/platform/workflow/trigger-workflow.md)):

```ts
import { Novu } from "@novu/api";
await novu.trigger({ workflowId: "...", to: [{ subscriberId: "string" }], payload: {...} });
```

`@novu/node` is deprecated (npm notice: "March 20, 2025 marks the end of support for @novu/node … migrate to the new @novu/api").

**React inbox.** The package is `@novu/react` (`<Inbox />`, Bell, Notifications, Preferences) ([docs: @novu/react](https://docs.novu.co/platform/sdks/react.md)). A React quickstart covers routing with React Router ([docs index](https://docs.novu.co/_llms/notify.txt)).

- **Styling** ([docs: styling](https://docs.novu.co/platform/inbox/configuration/styling.md)):
  - Uses the `appearance` prop with `baseTheme` (a built-in `dark` theme ships in `@novu/react/themes`), `variables` and `elements`.
  - Tailwind classes can be passed through `elements`.
  - Render props let you customise notification items, the bell and the popover ([docs index](https://docs.novu.co/_llms/notify.txt)).
- **Headless** ([docs: headless mode](https://docs.novu.co/platform/inbox/headless-mode.md)):
  - `useNotifications` handles pagination and real-time updates.
  - `useCounts` returns unread, unseen and total counts in real time.
  - `useNovu` gives access to the client for actions.

**Identity.** Recipients are "subscribers" identified by `subscriberId`. Docs say a subscriber "must exist" before sending. You can create one upfront through the API or dashboard, or Novu can "create a subscriber automatically at the moment a notification is triggered" from the trigger data ([docs: subscribers](https://docs.novu.co/platform/concepts/subscribers.md)).

**Browser authentication.** The client passes `applicationIdentifier` (public) and `subscriberId` ([docs: prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production.md)).

- Without extra security, "a malicious actor could potentially guess another subscriber's `subscriberId`".
- HMAC is a toggle you enable in the in-app provider settings. When it is on, the server computes `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` and the client sends it.
- Docs present HMAC as a production step, which implies it is optional in development.

**Real-time.** The JS client has `socketUrl` / `socketOptions` (e.g. `wss://eu.socket.novu.co`) ([docs: @novu/js](https://docs.novu.co/platform/sdks/javascript.md)). The hooks update in real time ([docs: headless mode](https://docs.novu.co/platform/inbox/headless-mode.md)).

**Templates.**

- **Dashboard:** visual workflow editor.
- **Novu Framework:** a code-first way to "build, version, and deploy notification workflows in TypeScript … sync to Novu Cloud". It uses a "bridge" endpoint in your app, with quickstarts for Express and Remix among others ([docs index: resources](https://docs.novu.co/_llms/resources.txt); [docs: framework intro](https://docs.novu.co/framework/introduction.md)).
- **Code steps:** step handlers written in TypeScript and published with the Novu CLI. Code steps can be mixed with UI-managed steps in the same workflow ([docs: code steps](https://docs.novu.co/platform/workflow/add-and-configure-steps/code-steps.md)).

**Read state.** The JS client supports ([docs: @novu/js](https://docs.novu.co/platform/sdks/javascript.md)):

- read and unread
- seen
- archive and unarchive
- snooze and unsnooze
- Bulk actions: `seenAll`, `readAll`, `archiveAll`, `archiveAllRead`

**Local dev / tests.**

- **Environments:** Development and Production by default. Production is view-only for workflows; changes are published from Development. Custom environments are only on Team and Enterprise ([docs: environments](https://docs.novu.co/platform/concepts/environments.md)).
- **Local mode:** `npx novu dev` opens the Dashboard in **Local** mode, connected through a tunnel to your locally running bridge. It replaces the older Local Studio on `localhost:2022` ([docs: local development](https://docs.novu.co/framework/studio.md)). This still depends on Novu Cloud and is not an offline emulator.
- **Demo email integration:** only delivers to the account owner's address ([docs: trigger workflow](https://docs.novu.co/platform/workflow/trigger-workflow.md)).

**Channels.** Email, in-app, SMS, chat and push ([pricing](https://novu.co/pricing)), plus "Tool" integrations such as PagerDuty, Opsgenie and webhooks ([docs index](https://docs.novu.co/_llms/notify.txt)).

---

## MagicBell

**Free tier.** "Builder", $0/mo: "1,000 Deliveries/mo.", 1 project, unlimited team members, unlimited users ([pricing](https://www.magicbell.com/pricing)).

- Deliveries are counted per channel: "if you send a notification to 100 users, all receive it in_app, but only 50 receive an email; we count that as 150 deliveries".
- The pricing page doesn't state retention.

**Next tier.** "Startup", $249/mo ([pricing](https://www.magicbell.com/pricing)):

- 50,000 deliveries, then $0.0025 per additional delivery
- 5 projects ($99 per additional project)

**Node SDK.** Docs name the package `magicbell-js`, with sub-path clients `magicbell-js/project-client`, `magicbell-js/user-client` and `magicbell-js/realtime` ([docs: Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)). npm shows `magicbell-js` at 1.8.0. A separate `magicbell` package (4.5.1, "MagicBell API wrapper") also exists, and it is unclear which is current.

- You send by creating a **broadcast** with a `recipients` array. A broadcast to a single recipient is still a broadcast: `client.broadcasts.createBroadcast({ title, content, category, actionUrl, recipients: [user] })`.
- "A notification is what users receive when they are a recipient of a broadcast" ([docs: notification primitive](https://www.magicbell.com/docs/primitive/notification)).
- Server calls authenticate with a Project JWT generated in the dashboard ([docs: API auth](https://www.magicbell.com/docs/api/authentication)).

**React inbox.** The package is `@magicbell/react`, with `ContextProvider` (takes a `token` prop holding the User JWT), `Inbox`, `FloatingInbox` and `InlineNotification` ([docs: React components](https://www.magicbell.com/docs/libraries/magicbell-react)).

- **Styling:**
  - Import the stylesheets (`@magicbell/react/styles/inbox.css`)
  - Override `--magicbell-*` CSS variables and `magicbell--*` classes
  - `ItemComponent` for custom notification rows
  - Custom trigger and inbox components for `FloatingInbox`
- **Headless:** the current `@magicbell/react` docs page doesn't document headless hooks. Custom UIs can use `magicbell-js/user-client` (list, mark read, archive, counts) together with `magicbell-js/realtime` ([docs: Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)). npm also has `@magicbell/react-headless` (5.5.1, "Hooks to build a notification inbox"), part of the older `@magicbell/magicbell-react` (11.5.1) family. Whether it is compatible with the current API is unverified.

**Identity.** Users are identified by `external_id` (recommended) or email ([docs: user primitive](https://www.magicbell.com/docs/primitive/user)).

- Once set, an external ID "cannot be changed or unset".
- Users are upserted. "We create users for you on the fly when you initialize the Inbox for them" ([docs: quick start](https://www.magicbell.com/docs/quick-start)).
- Users can also be created inline through broadcast `recipients`.

**Browser authentication.** A User JWT is required for user endpoints and the inbox ([docs: User JWT](https://www.magicbell.com/docs/api/authentication/user)).

- Your backend generates it, signed with HS256 using the project Secret Key.
- Payload: `user_external_id` and/or `user_email`, plus `api_key`.
- The docs show no optional, unauthenticated dev mode.

**Real-time.** "The Realtime client enables real-time notification delivery through WebSocket connections … without requiring polling" ([docs: Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)).

**Templates.**

- Content (`title`, `content`, `category`, `topic`, `action_url`, per-channel `overrides`) goes inline on each broadcast ([docs: Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)).
- The dashboard has a Create Broadcast page ([docs: quick start](https://www.magicbell.com/docs/quick-start)).
- Workflows are defined as JSON (`steps` with `broadcast` and `wait` commands) ([MagicBell workflows page](https://www.magicbell.com/workflows)). The CLI (`npm install -g magicbell-cli`) includes saving workflow definitions ([docs: CLI](https://www.magicbell.com/docs/libraries/magicbell-cli)).

**Read state.**

- Notifications track read, seen and archived ([docs: notification primitive](https://www.magicbell.com/docs/primitive/notification)).
- The user client has `markNotificationRead` / `Unread`, `archiveNotification` / `unarchiveNotification`, `markAllNotificationsRead`, `archiveAllNotifications` and `fetchUnreadNotificationsCount` ([docs: Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)).
- The inbox also supports delete ([docs: in-app channel](https://www.magicbell.com/docs/channels/in_app)).

**Local dev / tests.**

- Docs say to "create projects for staging/production environments", with a Project JWT for each ([docs: quick start](https://www.magicbell.com/docs/quick-start)). The free tier includes 1 project ([pricing](https://www.magicbell.com/pricing)).
- No test mode, sandbox or emulator was found in the docs.

**Channels.** Email (SES, Mailgun, SendGrid, SMTP, Ping Email), mobile push (APNs, FCM, Expo), web push, Slack, Teams, SMS (Twilio) and in-app ([docs sitemap: channels](https://www.magicbell.com/docs/channels)).

---

## Courier

**Free tier.** "Developer" plan: free, "10,000 sends per month", including Journeys, broadcasts, the MCP server, the CLI and SDKs ([pricing](https://www.courier.com/pricing)).

- "One send is one template sent to one recipient. A template that delivers by email, SMS, push, Slack, and in-app still counts as one send." Sends from Test and custom environments count too ([pricing FAQ](https://www.courier.com/pricing); [docs: billing](https://www.courier.com/docs/workspaces/billing.md)).
- In-app has no separate fee ([docs: billing](https://www.courier.com/docs/workspaces/billing.md)).
- The comparison table shows log retention of 30 days on Free and 1 year on paid ([pricing](https://www.courier.com/pricing)). Which column maps to which plan was inferred from page layout.

**Next tier.** "Business": $0.005 per send, "including the first 10,000", so 50,000 sends costs $250/month. No seat fees ([pricing](https://www.courier.com/pricing); [docs: billing](https://www.courier.com/docs/workspaces/billing.md)).

**Node SDK.** The package is `@trycourier/courier`. Docs say: "Send with `client.send.message` from the Node SDK (`@trycourier/courier` v7 and later, where the client is the default import)" ([docs: send to the inbox](https://www.courier.com/docs/in-app/send-to-the-inbox.md)).

```js
await client.send.message({ message: { to: { user_id: "user_123" }, template: "nt_…", routing: { method: "single", channels: ["inbox"] } } });
```

- A send can carry inline Elemental `content` instead of a `template` ([docs: send overview](https://www.courier.com/docs/send/overview.md)).
- The `message:` wrapper and inline `content: { title, body }` both appear in the official SDK README ([courier-node README](https://github.com/trycourier/courier-node)).

**React inbox.** Courier publishes `@trycourier/courier-react` (React 18+) and `@trycourier/courier-react-17` (React 17). Components are `<CourierInbox />`, `<CourierInboxPopupMenu />` and toasts, plus `useCourier()` ([docs: React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md)).

- **Styling** ([docs: customize the inbox](https://www.courier.com/docs/in-app/customize-the-inbox.md)):
  - `lightTheme` / `darkTheme` (`CourierInboxTheme`), with `mode` set to light, dark or system
  - Custom header, list item, and empty/loading/error components
- **Headless:** `useCourier()` exposes messages, unread count, pagination and actions. You must call `registerFeeds(defaultFeeds())`, then `listenForUpdates()`, then `load()` ([docs: build a custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox.md)).

**Identity.** Users are stored as profiles keyed by `user_id`. A send can carry inline contact details, which "Courier merges … over the saved profile for that message only" ([docs: users and profiles](https://www.courier.com/docs/recipients/overview.md)). In-app needs only the `user_id`.

**Browser authentication.** A JWT is required ([docs: authenticate users](https://www.courier.com/docs/in-app/authenticate-users.md)).

- Your backend calls `POST /auth/issue-token` (`client.auth.issueToken`) with a scope such as `user_id:user_123 inbox:read:messages inbox:write:events` and an `expires_in`.
- The client calls `signIn({ userId, jwt })`.
- The v8 migration guide moved from client keys to JWTs ([docs index](https://www.courier.com/docs/llms.txt)).
- No optional, unauthenticated dev mode is documented.

**Real-time.** "`inbox.listenForUpdates()` … opens the WebSocket connection required for real-time updates". The CSP must allow `wss://realtime.courier.io` ([docs: React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md)).

**Templates.**

- Templates and journeys "can be built in the Courier app or created through the API" ([docs index](https://www.courier.com/docs/llms.txt)).
- The Templates API supports a draft/publish lifecycle, so templates can be managed "as code from Git, the CLI, or an MCP agent" ([docs: templates API](https://www.courier.com/docs/design/templates/api.md)).
- Templates can also be skipped: pass inline Elemental content on each send ([docs: send overview](https://www.courier.com/docs/send/overview.md)).

**Read state.**

- Read/unread, opened, clicked, archived/unarchived, and `readAllMessages()` ([docs: build a custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox.md)).
- The inbox has Unread and Archived views out of the box ([docs: inbox](https://www.courier.com/docs/in-app/inbox.md)).
- A "seen" state separate from "read" is not documented.

**Local dev / tests.** Source: [docs: environments](https://www.courier.com/docs/workspaces/environments.md).

- Every workspace starts with Production and Test, and can have up to 20 environments.
- "Courier has no separate test mode: a Test key is what puts you in the Test environment."
- Draft keys (`dk_`) render unpublished templates.
- The Test environment has a built-in email test provider that only delivers to the signup address.
- No local emulator was found.

**Channels.** Email, SMS, push, chat (Slack, MS Teams) and in-app, with many providers for each ([docs: integrations](https://www.courier.com/docs/llms.txt)).

---

## SuprSend

**Free tier.** $0/mo, 10,000 notifications per month, unlimited channels and team members. The in-app feed shows SuprSend branding ([pricing](https://www.suprsend.com/pricing)).

- Log retention: 30 days on Free and 90 days on Essentials/Business.
- "If a workflow triggers notifications to one user on multiple channels … each channel counts as a separate notification."
- Notifications that fail because of opt-out or inactive channels are not billed.

**Next tier.** "Essentials": shown as **$100/month billed annually ($1,200)** for 50k notifications, then $2 per 1,000 extra. It removes branding ([pricing](https://www.suprsend.com/pricing)). The FAQ mentions monthly plans too, but no monthly price was visible.

**Node SDK.** The package is `@suprsend/node-sdk` ([docs: integrate](https://docs.suprsend.com/docs/integrate-suprsend.md)):

```js
const { Suprsend, WorkflowTriggerRequest } = require("@suprsend/node-sdk");
const w1 = new WorkflowTriggerRequest({ workflow: "...", recipients: [{ distinct_id: "user_1a2b3c" }], data: {...} });
await supr_client.workflows.trigger(w1);
```

**React inbox.** The drop-in `<Inbox />` comes from `@suprsend/react`. Headless hooks (`useFeedClient`, `useFeedData`, `useFeed`) come from `@suprsend/react-core` ([docs: React overview](https://docs.suprsend.com/docs/react-inbox-integration.md); [docs: headless feed](https://docs.suprsend.com/docs/react-sdk-headless-feed.md)).

- **Styling:** `theme` (`ITheme`) and `themeType` (dark/light), plus CSS customisation ([docs: React in-app feed](https://docs.suprsend.com/docs/react-in-app-feed.md)).
- The old `@suprsend/react-inbox` package (HMAC auth) is deprecated ([docs: migration guide](https://docs.suprsend.com/docs/react-migration-guide.md)).

**Identity.** Users are identified by `distinct_id`. "Identify" is an upsert ("the first call creates the profile, later calls update it") ([docs: integrate](https://docs.suprsend.com/docs/integrate-suprsend.md)). The trigger API also accepts inline user properties and channels ("Identify user inline") ([API: trigger workflow](https://docs.suprsend.com/reference/trigger-workflow-api.md)).

**Browser authentication.** `SuprSendProvider` takes `publicApiKey` and `distinctId`, plus a user token when required ([docs: client authentication](https://docs.suprsend.com/docs/client-authentication.md)).

- "Enhanced security mode" makes a signed user JWT mandatory: ES256, signed with a dashboard signing key, with a refresh-token callback.
- It is "recommended for Production workspaces", which implies it is optional elsewhere.

**Real-time.** The feed client "initialise[s] socket for realtime update". An opt-in reachability status reports on browser, socket and API connectivity ([docs: in-app feed](https://docs.suprsend.com/docs/inapp-feed.md); [docs: headless feed](https://docs.suprsend.com/docs/react-sdk-headless-feed.md)).

**Templates.**

- Templates and workflows are built in the dashboard ([docs: workflows](https://docs.suprsend.com/docs/design-workflow.md)).
- The SuprSend CLI lists, pulls, pushes and commits workflows, templates, schemas and translations, and syncs them across workspaces and CI/CD ([docs index: CLI](https://docs.suprsend.com/llms.txt)).
- A Management API is also available ([docs index](https://docs.suprsend.com/llms.txt)).

**Read state.** From [docs: in-app feed](https://docs.suprsend.com/docs/inapp-feed.md):

- `markAsSeen`, `markAsRead`, `markAsUnread`, `markAsArchived`, `markAsInteracted`
- Bulk actions: `markAllAsRead`, `markBulkAsSeen`
- A badge-reset call for when the bell is opened

The inbox template also supports pinning and expiry ([docs index](https://docs.suprsend.com/_llms/documentation.txt)).

**Local dev / tests.** Source: [docs: workspaces](https://docs.suprsend.com/docs/workspaces.md).

- **Sandbox:** a trial-period demo workspace with pre-configured vendors and capped usage.
- **Staging:** where Test Mode lives. In Test Mode, notifications go only to designated test channels, optionally redirected to a catch-all channel ([docs: test mode](https://docs.suprsend.com/docs/developer/test-mode.md)).
- **Production:** the live workspace.
- **Custom workspaces** can be added.
- No local emulator was found.

**Channels.** Email, SMS, WhatsApp, mobile and web push, Slack, Microsoft Teams, in-app inbox and webhook ([docs: add a channel](https://docs.suprsend.com/docs/add-a-channel.md); [pricing FAQ](https://www.suprsend.com/pricing)).

---

## Notable trade-offs

- **Billing units differ.**
  - Courier bills per send (template × recipient), regardless of channel count.
  - Novu bills per workflow run per subscriber.
  - Knock, MagicBell and SuprSend bill per channel delivery.
  - For in-app-only, one recipient per notification, these mostly line up at 1 unit per notification. They diverge once more channels are added.
- **Free-tier headroom.**
  - Knock (unverified), Novu, Courier and SuprSend each advertise about 10k units/month.
  - MagicBell's Builder is 1,000 deliveries/month and 1 project. Its docs model staging and production as separate projects.
- **Paid-tier entry points.**
  - Novu Pro: from $30/mo.
  - Courier: pay-as-you-go at $0.005 from the first send (10k sends = $50).
  - SuprSend Essentials: $100/mo, billed annually.
  - MagicBell Startup: $249/mo.
  - Knock Starter: reported as $250/mo (unverified).
- **Novu Free limits.** Novu Free's comparison table appears to cap workflows at 5, and activity logs are kept only 24h. That matters if each notification type is its own workflow.
- **Retention.** Most stated figures are about logs, not feed contents. Knock says in-app feed items stay available "indefinitely". Novu lists inbox feed retention separately (30 days on Free per the table).
- **Browser auth in development.**
  - Knock, SuprSend and Novu let the feed work with a public key plus user id while you develop, then add signed tokens or HMAC for production.
  - Courier and MagicBell require a server-minted JWT from the start.
  - Cadence already has a Node server, so either model needs one server route or loader to mint the token or hash.
- **Code-defined content.**
  - Novu has the most code-first option: Framework workflows plus code steps written in TypeScript.
  - Courier and MagicBell allow fully inline content on each send.
  - Knock and SuprSend keep content in dashboard-managed templates, with a CLI and Management API for pulling and pushing as files.
- **Sending model.** MagicBell's send primitive is a "broadcast" with a recipients array, even for a single user. The others trigger a workflow or template for a recipient.
- **Read-state models differ.**
  - Novu adds snooze.
  - Knock and SuprSend track seen separately from read, and add interacted.
  - Courier tracks opened and clicked; no separate "seen" is documented.
  - MagicBell offers read, seen, archive and delete.
  - Every provider has a bulk mark-all-read.
- **Testing.**
  - No provider documents an offline emulator or fake transport for its hosted service. Tests would need to mock the SDK client at Cadence's own boundary, or use a non-production environment.
  - Knock's sandbox mode does not cover in-app.
  - Courier bills Test-environment sends.
  - SuprSend's Test Mode only exists in Staging.
  - Novu's `novu dev` needs a cloud tunnel.
- **Identity sync.**
  - Knock, Novu, MagicBell and SuprSend can create or update the recipient inline on trigger, so no separate identify step is needed.
  - Courier sends by `user_id`. For in-app, no stored contact data is needed.
- **React versions.** Courier has a separate package for React 17. The others publish one React package each.

---

## Unverified / caveats

1. **Knock pricing is unverified.** `https://knock.app/pricing` returned HTTP 403 to the fetch tool and was blocked by the corporate proxy. These figures came only from search-result snippets of Knock-owned blog and marketing pages, not from the pricing page:
   - Free: 10,000 messages/mo
   - Starter: $250/mo for 50k messages, $0.005 overage, removes branding

   Knock's seat limits and Free-plan environment limits are also unknown.
2. **Novu plan-table values were parsed from page HTML.** The free workflow limit of 5, unlimited subscribers and 30-day inbox feed retention came from the comparison table's row order. The page also disagrees with itself about Pro team members: the cards say unlimited, the table says 3. Re-check on the live page.
3. **Courier log retention.** The "30 days" and "1 year" values were mapped to Free and paid by column layout. The page didn't explicitly label them.
4. **SuprSend monthly pricing.** Only the annual-billed figures ($100/mo = $1,200/yr Essentials; $250/mo = $3,000/yr Business) were visible. The month-to-month price wasn't shown.
5. **MagicBell.**
   - Retention isn't stated on the pricing page.
   - Two npm packages exist (`magicbell-js` per the current docs, and `magicbell`); which one is canonical for server use wasn't confirmed.
   - Whether `@magicbell/react-headless` (legacy family) works with the current User-JWT API wasn't verified.
   - No test mode or sandbox was found in the docs. One may exist that wasn't found.
6. **Courier SDK version.** The send shape was confirmed against the SDK README on `main`, but it wasn't checked against the v10.0.0 tag specifically.
7. **Branding on free tiers.** Novu and SuprSend free tiers show vendor branding in the inbox (per their pricing pages). Knock's appears to (per an unverified snippet). Courier's and MagicBell's branding policies weren't stated on their pricing pages.
8. **npm versions.** Versions came from a mirrored npm registry (`npm view`) on 2026-11-13. Publish dates from that mirror weren't reliable, so they're omitted.
9. **"Optional in dev" claims.** For Knock, the docs say explicitly that enhanced security is off by default. For Novu (HMAC toggle) and SuprSend (enhanced mode "recommended for Production"), optional-in-dev is inferred from the docs' wording and toggle-based setup.
