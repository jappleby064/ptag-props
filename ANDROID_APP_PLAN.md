# PTAG Props — Android App Plan

## Overview

A native Android app (Kotlin + Jetpack Compose, Material 3) mirroring the Swift
app. Offline-first browse of the PTAG Props inventory plus a local-only
**Picking List** feature.

Phase 1: read-only, offline-capable browse + picking list.
Phase 2 (optional): admin write support.

## Stack

- Kotlin 2.x, Jetpack Compose (Material 3)
- **Room** for local persistence (items, images, reports, picking-list entries)
- **Ktor client** or **Retrofit + OkHttp** for HTTP (Retrofit chosen here for
  team familiarity)
- **Coil** for image loading + disk cache
- **WorkManager** for the daily background sync
- **DataStore** (Preferences) for `baseUrl`, `lastSyncedAt`, `etag`
- **Hilt** for DI (optional — manual DI is fine at this size)
- minSdk 26 (Android 8.0), targetSdk 34

## Data source

Same as Swift app:
- Inventory: `https://jappleby064.github.io/ptag-props/inventory.json`
- Images: `https://jappleby064.github.io/ptag-props/uploads/<filename>`

Base URL is overridable in Settings.

## Offline-first sync strategy

Identical contract to Swift app:

1. **First launch** — fetch JSON, persist to Room, prefetch primary images
   into Coil's disk cache.
2. **Subsequent launches** — render from Room immediately; kick off background
   sync via `WorkManager` (one-shot expedited work).
3. **Daily refresh** — `PeriodicWorkRequest` every 24 h (with network
   constraint). Uses `If-None-Match` / ETag where available; otherwise diff by
   `updated_at` per item and upsert changed rows only.
4. **Pull-to-refresh** — manual sync (`SwipeRefresh` in Compose).
5. **Image cache** — Coil `imageLoader` configured with 250 MB disk cache;
   prefetcher walks the post-sync item list and warms primary images.

## Project structure

```
app/src/main/java/uk/peoplestheatre/props/
  PtagPropsApp.kt                 // Application class, WorkManager init
  MainActivity.kt                 // single-activity, NavHost
  data/
    db/
      AppDatabase.kt              // Room
      ItemDao.kt
      PickingListDao.kt
      entities/
        ItemEntity.kt
        ItemImageEntity.kt
        ReportEntity.kt
        PickingListEntry.kt
    remote/
      InventoryApi.kt             // Retrofit interface
      InventoryDto.kt             // matches JSON shape
    repository/
      InventoryRepository.kt      // sync logic, ETag handling
      PickingListRepository.kt
  sync/
    SyncWorker.kt                 // WorkManager worker
    SyncScheduler.kt              // schedules daily + on-launch sync
  ui/
    browse/  BrowseScreen.kt, ItemCard.kt
    detail/  ItemDetailScreen.kt
    picking/ PickingListScreen.kt, PickingListExport.kt   // PDF generation
    settings/ SettingsScreen.kt
    theme/  Theme.kt, Color.kt, Type.kt
```

## Picking List feature (app-only)

Same contract as Swift app:

- **Add** — button on detail screen, swipe action on browse rows.
- **Manage** — dedicated screen: reorder, swipe-to-remove, "Clear All".
- **Export** — share sheet → "Export PDF" using **`PdfDocument`** (Android
  framework) with the same A4 multi-item-per-page layout as the website. Drawn
  on a `Canvas` (image bitmap + text); shared via `FileProvider` so users can
  save to Drive/email.
- **Storage** — `PickingListEntry(id, assetId, addedAt, listName)` in Room.
  Resolved against cached items at render time; missing items show a
  placeholder.

## Background sync

`SyncWorker` (CoroutineWorker):

```kotlin
class SyncWorker(...) : CoroutineWorker(...) {
    override suspend fun doWork(): Result = try {
        repository.syncIfStale(force = inputData.getBoolean("force", false))
        Result.success()
    } catch (e: IOException) { Result.retry() }
}
```

Scheduled by `SyncScheduler.scheduleDaily()` on first launch:

```kotlin
WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
    "daily-inventory-sync",
    ExistingPeriodicWorkPolicy.KEEP,
    PeriodicWorkRequestBuilder<SyncWorker>(24, TimeUnit.HOURS)
        .setConstraints(Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
)
```

## Phase 1 feature list

1. Bottom nav: Browse / Picking List / Settings
2. Type filter chips, search bar
3. Item detail with horizontal pager image gallery, flag badges
4. Pull-to-refresh + 24 h background sync
5. Offline image cache via Coil
6. Picking list CRUD + PDF export via `PdfDocument`
7. Settings: base URL, last-synced timestamp, force resync, clear cache

## Phase 2 — Admin writes (optional)

- Login screen → JWT stored in **EncryptedSharedPreferences**
- Add/edit item, multipart image upload
- Delete with confirm
- Report missing/broken

## Distribution

| Option | Cost | Notes |
|---|---|---|
| Internal sharing APK via email/Drive | £0 | Cast/crew sideload |
| Google Play Internal Testing | £20 one-off | Up to 100 testers, no review delay |
| Google Play production | £20 | Public listing, 7-day review |

Recommended: Play Internal Testing — no public listing required, easy install
via opt-in link.

## Notes

- Match the Swift app's UX closely so cross-platform users have parity.
- The picking list PDF layout must match the website's print stylesheet so the
  outputs are visually consistent.
- WorkManager periodic minimum interval is 15 min; 24 h is well within bounds.
- Use `androidx.print.PrintManager` as an alternative export path so users can
  send the same A4 layout to a network printer directly.
