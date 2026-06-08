# Original User Request

## Initial Request — 2026-06-08T09:30:28Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Fix frontend errors using teamwork_preview

Analyze all frontend pages of the ZONIX application (using a browser) to identify console errors—such as the missing Firebase composite indexes currently breaking the orders page—and fix the underlying code or provide actionable deployment steps.

Working directory: `d:\Desktop\Website\Amazon\frontend`
Integrity mode: development

## Requirements

### R1. Comprehensive Error Auditing
Launch a local development server and use a headless browser to visit every core page of the ZONIX application (Home, Profile, Cart, Checkout, Shop, PDP, Login). Capture all browser console errors.

### R2. Issue Remediation
Fix any frontend JavaScript or CSS errors discovered during the audit. For backend configuration issues (e.g., missing Firestore composite indexes), document the exact Firebase Console URLs required to create them.

## Acceptance Criteria

### Error-Free Console
- [ ] All pages load without client-side JavaScript exceptions (excluding network ad-blocker warnings).
- [ ] The `profile` and `shop` pages successfully fetch data from Firebase without throwing "query requires an index" errors (once the user applies the index).

## Parent Agent Update � 2026-06-08T09:54:58Z

The user has shut down the local server. Do not launch a headless browser yourself. I have deployed a dedicated `browser` subagent to visit the live URL `https://official-arvind.github.io/Amazon/frontend/`. Please stand by. I will forward you the list of errors it discovers so you can fix them.

## Parent Agent Update � 2026-06-08T09:59:46Z

The server was restarted. Please stay in standby mode. I have revived the browser subagent and am waiting for it to send me the list of errors from https://official-arvind.github.io/Amazon/frontend/. I will forward them to you to fix once received.
