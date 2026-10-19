# FormaCore

Dependency-free Foundation package for iOS 17+ and macOS 13+, using Swift tools 5.9.

- `JSONValue`: Codable, Equatable and Sendable. Cases are `null`, `bool(Bool)`, `number(Double)`, `string(String)`, `array([JSONValue])` and `object([String: JSONValue])`. String/index subscripts return `.null` for a missing key, wrong container or out-of-range index. Typed accessors return optional values and never coerce a string, boolean or missing field into a number. Non-finite numbers cannot be encoded.
- `FormaUser(id:email:name:)` and `SyncSnapshot(state:revision:entityVersions:)` are public Codable values. The app must enforce account binding; this package has no HTTP or persistence layer.
- `NativeRecords.meal(name:date:grams:kcal:protein:carbs:fat:type:)` stores user-entered nutrition per 100 g with `referenceGrams:100` and the actual serving. Types are breakfast/lunch/dinner/snack. Nutrition and serving bounds mirror the current API, including its macro and calorie/reference checks.
- `NativeRecords.sleep(start:end:quality:energy:timezone:)` stores actual elapsed instants, an IANA zone and the wake-up calendar day in that zone. Duration must be positive and no more than 24 hours; quality/energy are 1...5.
- `NativeRecords.workout(name:date:duration:exerciseName:sets:reps:weight:notes:)` records a genuine, user-entered exercise summary. It preserves fractional minutes and explicit zero kg. It writes no `setLogs`, invented individual sets or RPE.

All factories throw `NativeRecordError`, allocate a UUID once, and stamp the real creation time. Meal/workout calendar dates use the current device time zone. The caller must keep a generated record and mutation identifier for retries instead of calling a factory again after an ambiguous response. Errors do not include record content.

`Metrics.mealTotals(_:)` scales by serving/reference weight without intermediate rounding; missing/invalid inputs return nil and known zero remains zero. `dailySummary(state:date:timeZone:)` returns `DayMetrics`; `summary(state:days:)` returns `RangeMetrics`. Both read saved `meals`, `workouts` and `sleeps`, not active workouts. Range coverage counts valid recorded days out of unique valid requested dates; it does not imply complete daily intake. Range fields are totals across recorded days, not averages across unrecorded days. Sleep intervals on the same wake-up day are merged before totaling, so overlapping observations do not invent additional hours.

`Metrics.trainingSummary(_ workouts:[JSONValue])` returns `TrainingMetrics`: sessions, minutes, detailedSessions, summarySessions, completedSets, volumeKg and unknownLoadSets. Only actual completed work/drop rows with recorded completion evidence are counted; warm-ups and unchecked rows are excluded. Without detailed set logs, sets and volume are nil. A completed timed row may have unknown load/reps and is then counted in unknownLoadSets. Set loads are stored in kg; display-unit conversion belongs to the UI. `minutes` preserves recorded fractional durations and is nil if none are valid. No record implies nil metrics, not zero activity.

Synthetic API fixtures live at `Tests/FormaCoreTests/Fixtures/{meal,sleep,workout}.json`. They are raw records, not request envelopes. XCTest consumes the same files through `Bundle.module`; the Node contract test can place them in record-level sync mutations and verify the existing API.

Run on a Swift-equipped host with `swift test --package-path ios/Packages/FormaCore`. The initial implementation was written on Windows without Swift; compilation and XCTest results must be taken from the actual Mac CI run, not inferred from this source.
