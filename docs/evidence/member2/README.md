# Person 2 — Evidence Index

Read alongside ../../member2-handover.md.

These screenshots document local application behaviour and logs received
by the HustleHub Backend source in Better Stack.

| Evidence | Screenshot |
|---|---|
| Freelancer dashboard showing R500 earnings | [Dashboard](<Screenshot 2026-11-09 020943.png>) |
| Incorrect-password response | [Login rejection](<Screenshot 2026-11-09 021227.png>) |
| Failed-login cloud event with safe metadata | [Login failure event](<Screenshot 2026-11-09 021303.png>) |
| Separate authentication request limiter | [Request-limit response](<Screenshot 2026-11-09 021723.png>) |
| Account cooldown remains active after backend restart | [Persistent cooldown event](<Screenshot 2026-11-09 021906.png>) |
| Login remains blocked during the account cooldown | [Cooldown response](<Screenshot 2026-11-09 021944.png>) |
| Profile 200, logout 200, same token rejected with 401 | [Revocation HTTP results](<Screenshot 2026-11-09 022157.png>) |
| Cloud rejection event with reason session_revoked | [Revoked-session event](<Screenshot 2026-11-09 022232.png>) |

Additional screenshots in this folder show the cloud connection,
registration, gig creation, booking, and transaction demonstration.

## Interpretation

- Account cooldown and request rate limiting are separate controls.
- The restart evidence shows that the account cooldown persists.
- The revocation demonstration reuses the same token after logout.
- Payment was simulated; no real payment was processed.
- The R500 dashboard result describes the single demo booking.
- Screenshots support the automated test results recorded in the handover.