# In-app Notifications go through Novu Cloud, with content written in Cadence

Cadence sends in-app Notifications through Novu Cloud (hosted) on its free tier. Every Notification goes through **one generic in-app workflow**: Cadence passes the title, body and link in the trigger payload, so the content lives in Cadence's code next to the event that causes it, the same way email bodies already do. We chose Novu for its code-first content, the cheapest paid tier we could verify ($30/mo), a React inbox with headless hooks, and a feed that works with a public identifier during development (HMAC is added for production).

## Considered Options

- **Knock**: strong React feed, but templates live in its dashboard, and its pricing (reportedly $250/mo for the first paid tier) couldn't be verified.
- **Courier**: content can be sent inline and pricing is pay-as-you-go, but the browser feed needs a server-minted JWT from the start, and sends in the Test environment are billed.
- **SuprSend**: dashboard-managed templates, and the paid tier is billed annually only.
- **MagicBell**: only 1,000 deliveries a month and one project on the free tier.

See the research: `docs/research/notification-providers.md` on the `research/notification-providers` branch.

## Consequences

- Novu's free tier caps workflows at about 5. That doesn't bind us, because each kind of Notification is a payload variant rather than its own workflow. Don't "fix" this by creating one workflow per Notification.
- Novu's free tier keeps inbox feed items for 30 days, so older Notifications disappear from the feed.
- Novu has no offline emulator, so tests and local dev must fake the sender at Cadence's own boundary.
