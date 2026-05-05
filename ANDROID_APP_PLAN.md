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
- Items API: `https://thepeoplesprops.uk/api/items`
- Images: `https://thepeoplesprops.uk/uploads/<filename>`

Base URL defaults to `https://thepeoplesprops.uk` and is overridable in Settings.

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
      PickingListDao.kt           // queries on both PickingList and PickingListEntry
      entities/
        ItemEntity.kt
        ItemImageEntity.kt
        ReportEntity.kt
        PickingListEntity.kt      // named list header
        PickingListEntryEntity.kt // asset ID row within a list
    remote/
      InventoryApi.kt             // Retrofit interface
      InventoryDto.kt             // matches JSON shape
    repository/
      InventoryRepository.kt      // sync logic, ETag handling
      PickingListRepository.kt    // CRUD for lists and entries
  sync/
    SyncWorker.kt                 // WorkManager worker
    SyncScheduler.kt              // schedules daily + on-launch sync
  ui/
    browse/   BrowseScreen.kt, ItemCard.kt
    detail/   ItemDetailScreen.kt
    picking/
      PickingListsScreen.kt       // index of all named lists
      PickingListDetailScreen.kt  // items in one list, reorder, export
      AddToListSheet.kt           // bottom sheet: choose or create a list
      PickingListExport.kt        // PdfDocument A4 generation
    settings/ SettingsScreen.kt
    theme/    Theme.kt, Color.kt, Type.kt
```

## Picking List feature (app-only)

Multiple named lists, all stored locally in Room. Never synced to the server.

### Room entities

```kotlin
@Entity(tableName = "picking_lists")
data class PickingListEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "picking_list_entries",
    foreignKeys = [ForeignKey(
        entity = PickingListEntity::class,
        parentColumns = ["id"],
        childColumns = ["listId"],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index("listId")],
)
data class PickingListEntryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val listId: String,
    val assetId: String,
    val addedAt: Long = System.currentTimeMillis(),
    val position: Int,          // for user-controlled ordering
)
```

### DAO

```kotlin
@Dao interface PickingListDao {
    @Query("SELECT * FROM picking_lists ORDER BY updatedAt DESC")
    fun allLists(): Flow<List<PickingListEntity>>

    @Query("SELECT * FROM picking_list_entries WHERE listId = :id ORDER BY position")
    fun entriesFor(id: String): Flow<List<PickingListEntryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertList(l: PickingListEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertEntry(e: PickingListEntryEntity)
    @Delete suspend fun deleteList(l: PickingListEntity)
    @Delete suspend fun deleteEntry(e: PickingListEntryEntity)
    @Query("DELETE FROM picking_list_entries WHERE listId = :id") suspend fun clearList(id: String)
}
```

### UX flows

- **Lists index** (`PickingListsScreen`) — `LazyColumn` of list cards showing
  name, item count, last-modified. FAB creates a new list (alert dialog for
  name). Swipe-to-dismiss deletes with undo snackbar. Long-press → rename.
- **Add to list** — from the detail screen and as a swipe action on browse rows,
  an `AddToListSheet` (modal bottom sheet) shows all lists with a checkmark on
  those already containing the item. Tap a list to add/remove. "New list" row at
  the bottom opens a name dialog then adds to the newly created list.
- **List detail** (`PickingListDetailScreen`) — `LazyColumn` with
  `ReorderableItem` (e.g. `sh.calvin.reorderable`), swipe-to-dismiss entries,
  "Clear" menu item with confirm, rename via `TopAppBar` title click.
- **Export** — share icon on the detail screen generates the PDF via
  `PdfDocument`, writes to `FileProvider` cache dir, and fires an `ACTION_SEND`
  intent. PDF filename uses the list name.
- **Stale entries** — entries whose `assetId` is absent from the local Room
  `items` table render as a greyed-out placeholder row with a "Remove" button.

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

1. Bottom nav: Browse / Picking Lists / Settings
2. Type filter chips, search bar
3. Item detail with horizontal pager image gallery, flag badges
4. Pull-to-refresh + 24 h background sync
5. Offline image cache via Coil
6. Multiple named picking lists, CRUD + PDF export per list via `PdfDocument`
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
