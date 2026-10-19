# IOS-02 FormaCore

2026-10-18. Owner: inspect_library. Writable scope: `ios/Packages/FormaCore/**` and this status only.

## Current state

Implementation and synthetic fixtures are written; awaiting real Swift compilation/XCTest on the lead's Mac CI. No claim of an installed iPhone app or verified Swift build.

- Added a dependency-free Swift 5.9 package for iOS 17+/macOS 13+.
- Public JSONValue, FormaUser and SyncSnapshot preserve unknown API fields and distinguish missing values from zero.
- Public NativeRecords factories validate actual meal servings/per-100-g nutrients, timezone wake-up-day sleep, and a user-entered workout summary with real duration/exercise/sets/reps/kg; factories allocate UUIDs and real creation stamps.
- Following the lead's correction, workout requires an actual exercise summary rather than an empty exercises array. No server contract changed and no set logs or ratings are invented.
- Metrics expose optional nutrition/time/sleep totals, recorded-day coverage, and detailed-only training set/volume facts. Overlapping sleep on the same wake day is merged.
- Added XCTest coverage for JSON round-trips, wrong types/missing values, finite numbers, fixture shape, bounds, timezone/DST, reference weights, empty states, actual work/drop rows and legacy summaries.
- Three raw, entirely synthetic fixtures are available for Node API contract tests in `Tests/FormaCoreTests/Fixtures/`.

## Validation

- `Get-Command swift -ErrorAction SilentlyContinue`: no Swift executable returned on this Windows host. Swift compilation and XCTest have **not** been run locally.
- Node API contract execution is assigned to QA; no server started or health data read by this owner.
- Lead owns the integrated build and Mac CI.
- `git diff --check -- ios/Packages/FormaCore docs/collaboration/status/ios-core.md`: exit 0. This only checks tracked diff whitespace; it is not a Swift compilation result.
- PowerShell `ConvertFrom-Json` plus `[guid]::TryParse` for all three fixtures: JSON parsed, UUIDs valid, all explicitly synthetic/manual records.

## Coordination

- Read AGENTS.md, latest TASKS.md and ADR-ios-native-20261018.md before writing.
- Notified lead of the initial empty-exercises/API mismatch. Lead retained the backend contract and specified the actual exercise-summary parameters; features and QA were notified.
- Sent features the exact JSONValue, NativeRecords and Metrics interfaces; sent QA the fixture paths and raw-record contract.
- No commits, installs, network clients or changes outside the assigned paths.

## Awaiting user decisions

None within this package. Device signing, Apple Developer membership and production service selection remain with the lead/user.
