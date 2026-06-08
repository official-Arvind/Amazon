# Original User Request

## Initial Request — 2026-06-08T09:31:00Z

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

Your working directory is d:\Desktop\Website\Amazon\.agents\orchestrator\. The main project directory is d:\Desktop\Website\Amazon\. Manage your subagents and write your progress to progress.md and your plan to plan.md in your working directory. You must use send_message to report when all milestones are complete so that a victory auditor can be spawned.
