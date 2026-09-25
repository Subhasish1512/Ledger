# Ledger - Spend Tracker

## Problem statement
Build an Android-first offline ledger app for Subhasish to track spending, review totals by week or month, filter by category, manage categories, add notes to payments, and export any date range to PDF. No login or network connection is required. Currency is Indian Rupee and dates use DD/MM/YYYY.

## Architecture
- Expo SDK 57 React Native mobile app with Expo Router.
- Single dashboard screen with modal bottom sheets for quick actions, payments, categories, and PDF export.
- AsyncStorage-backed local persistence through the provided storage helper; no backend or API dependency.
- PDF creation through `expo-print` and sharing through `expo-sharing`.
- Theme tokens live in `frontend/src/theme.ts` and follow the design guidelines.

## User personas
- **Subhasish:** wants a fast, private, low-friction way to record everyday spends on an Android phone.
- **Occasional reviewer:** wants a simple period summary and shareable PDF report without signing in.

## Core requirements (static)
- Dashboard total for current month or week.
- Category breakdown and category dropdown filter.
- Add, edit, and delete payments with amount, category, date, and optional note.
- Add, rename, and delete categories.
- Transfer spends to another category before deleting a used category.
- Undo accidental payment deletion.
- Export any date range to PDF with summary, category breakdown, and payment list.
- Offline-only persistence and “Made by Subhasish” footer.

## Implemented
- 2026-09-25: Replaced starter placeholder with the complete offline ledger dashboard.
- 2026-09-25: Added default categories, ₹ formatting, DD/MM/YYYY entry, weekly/monthly totals, dropdown filtering, and empty states.
- 2026-09-25: Added payment create/edit/delete, note field, undo snackbar, and local persistence.
- 2026-09-25: Added category CRUD and used-category spend transfer flow.
- 2026-09-25: Added date-range PDF generation/sharing with summary, category breakdown, itemized payments, and footer.
- 2026-09-25: Added small-screen bottom-sheet positioning, strict calendar validation, themed modal backdrop, and Android-friendly touch targets.
- 2026-09-25: Verified lint, TypeScript, dashboard rendering, add/edit/filter flow, PDF sheet, small-screen quick actions, and invalid-date handling.
- 2026-09-25: Fixed the category dropdown menu rendering beneath the empty-state card by moving it into an anchored full-screen modal (opaque, backdrop dismiss, opens upward near the screen bottom); payment and transfer pickers no longer offer an invalid "All categories" option.

## Prioritized backlog
- **P0:** None for the requested offline MVP.
- **P1:** Add a native calendar/date picker for faster date entry; add explicit automated test IDs for every form control.
- **P2:** Add optional recurring spends, monthly budget targets, and a lightweight CSV export.

## Next tasks
1. Validate the generated PDF on a physical Android device and confirm the native share sheet.
2. Add a native date picker while retaining DD/MM/YYYY display.
3. Add optional budget alerts after the core ledger is used in practice.