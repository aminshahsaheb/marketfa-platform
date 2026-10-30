# ADR 0003: Bounded Offline Operation

- **Status:** Accepted as initial direction
- **Date:** 2026-10-30

## Context
Retailers may have unstable connectivity, but independent offline devices cannot safely allocate the same shared stock without coordination.

## Decision
Support explicit offline capture and idempotent replay. The server remains authoritative. The first release must not promise unrestricted multi-device offline stock selling. The exact permitted offline command set is a product decision based on pilot requirements and risk.

## Consequences
- Offline status and queued command state must be visible.
- Replays can be rejected or require operator review.
- Idempotency and conflict handling are mandatory.
- Any single-terminal/offline quota policy requires discovery and tests before implementation.
