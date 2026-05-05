# PTAG Props — Swift App Plan (iOS + macOS)

## Overview

A SwiftUI multiplatform app (iOS 17+, macOS 14+) for browsing the PTAG Props
inventory **offline-first**, with a local-only **Picking List** feature.

Phase 1: read-only, offline-capable browse + picking list.
Phase 2 (optional): admin write support via the Express server.

## Data source

| Resource | URL |
|---|---|
| Items API | `https://thepeoplesprops.uk/api/items` |
| Images | `https://thepeoplesprops.uk/uploads/<filename>` |

Base URL defaults to `https://thepeoplesprops.uk` and is configurable in
Settings so staff can also point at the LAN server (`http://<laptop>.local:3000`)
during tech week if needed.

## Offline-first sync strategy

The app must work with no network after the first launch.

1. **First launch** — fetch full `inventory.json`, persist to local store, also
   prefetch primary images for every item (background queue, low-priority).
2. **Subsequent launches** — load from local store immediately, then kick off a
   conditional refresh in the background (see below).
3. **Daily refresh** — once per 24 h (tracked via `UserDefaults` key
   `lastSyncedAt`), and on every cold launch if more than 24 h have passed,
   re-fetch `inventory.json`. Use `If-Modified-Since` / `ETag` headers if the
   server supplies them; otherwise diff by `updated_at` per item.
4. **Manual refresh** — pull-to-refresh on the list view triggers an immediate
   sync regardless of the daily clock.
5. **Image cache** — `URLCache` (50 MB memory / 500 MB disk) plus a manual
   prefetcher that downloads any new/changed primary image after sync.

### Local persistence

- **SwiftData** (iOS 17+) for items, images, reports — mirrors JSON shape.
- `Item`, `ItemImage`, `ItemReport`, `PickingList`, `PickingListEntry` as `@Model` classes.
- A single `SyncMetadata` model row stores `lastSyncedAt`, `etag`,
  `inventoryHash` (sha256 of last successful payload to short-circuit re-decode).

## Project structure

```
PTAGProps/
  PTAGPropsApp.swift              // @main, sync scheduler
  Models/
    Item.swift                    // @Model — mirrors inventory.json
    ItemImage.swift
    ItemReport.swift
    PickingList.swift             // @Model — named list, local-only
    PickingListEntry.swift        // @Model — asset ID + position within a list
    SyncMetadata.swift
  Networking/
    InventoryClient.swift         // async fetchItems() with ETag support
    ImagePrefetcher.swift         // background primary-image warm-up
    AuthClient.swift              // (Phase 2)
  Sync/
    SyncCoordinator.swift         // schedules daily + on-launch sync
  ViewModels/
    InventoryStore.swift          // @Observable
    PickingListStore.swift        // @Observable, multi-list CRUD
  Views/
    ContentView.swift             // TabView: Browse / Picking Lists / Settings
    BrowseView.swift              // searchable list, type filter
    ItemDetailView.swift          // gallery, fields, "Add to List…" sheet
    PickingListsView.swift        // index of all named lists, create/delete/rename
    PickingListDetailView.swift   // items in one list, reorder, export
    PickingListExportView.swift   // PDF generation (A4, multi-item per page)
    SettingsView.swift            // base URL, last-synced, force resync
  Resources/
    Assets.xcassets
```

## Picking List feature (app-only)

Multiple named lists of asset IDs. All lists persist across app restarts in
SwiftData and are never synced to the server.

### Data models

```swift
@Model final class PickingList {
    @Attribute(.unique) var id: UUID
    var name: String                          // e.g. "Act 1 Scene 3"
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \PickingListEntry.list)
    var entries: [PickingListEntry]
}

@Model final class PickingListEntry {
    @Attribute(.unique) var id: UUID
    var assetId: String
    var addedAt: Date
    var position: Int                         // for user-controlled ordering
    var list: PickingList
}
```

### UX flows

- **Lists index** (`PickingListsView`) — shows all saved lists as cards with
  item count and last-modified date. Toolbar button creates a new named list
  (inline rename field, defaults to "List \(n)"). Swipe-to-delete a list with
  confirm. Long-press → rename.
- **Add to list** — from `ItemDetailView` and as a swipe action on browse rows,
  a bottom sheet lets the user pick which list to add to (or tap "+ New List" to
  create one on the spot). If the item is already in a list it is marked with a
  checkmark; tapping again removes it.
- **List detail** (`PickingListDetailView`) — reorderable (`List` with
  `.onMove`), swipe-to-remove per row, "Clear All" with confirm, rename list via
  navigation title tap.
- **Export** — toolbar share button on `PickingListDetailView` → "Export PDF".
  Generated via `PDFKit` / `UIGraphicsPDFRenderer` in the same A4 two-column
  layout as the website (image, asset ID, name, location, storage; ~8 items per
  page). PDF filename includes the list name.
- **Stale entries** — entries whose `assetId` can no longer be found in the
  local `Item` store show a "no longer in inventory" placeholder row with a
  "Remove" button.

## Data model (Item.swift)

```swift
@Model final class Item {
    @Attribute(.unique) var id: Int
    var assetId: String
    var type: String
    var itemCategory: String
    var name: String
    var storageArea: String?
    var storageLocation: String?
    var size: String?
    var dimensions: String?
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade) var images: [ItemImage]
}
```

Decode the GitHub Pages JSON (`{ items, images, reports, ... }`), join images
and unresolved reports onto items, then upsert into SwiftData by `id`.

## Phase 1 feature list

1. Tab bar: Browse / Picking Lists / Settings
2. Type filter (All / Props / Furniture / Costumes), searchable
3. Item detail with image gallery, flag badges (missing/broken)
4. Pull-to-refresh + background daily sync
5. Offline image cache; placeholder when an image hasn't been prefetched yet
6. Multiple named picking lists, CRUD + PDF export per list
7. Settings: base URL, "last synced X minutes ago", force resync, clear cache

## Phase 2 — Admin writes (optional)

- Login → `POST /api/auth/login` → JWT in Keychain (`kSecClassGenericPassword`,
  service `ptag-props`)
- Add / edit item form, multipart image upload
- Delete with confirm
- Report missing/broken endpoints

Phase 2 requires the Express server reachable. Skip if wardrobe-laptop admin
workflow is sufficient.

## Distribution

| Option | Cost | Devices |
|---|---|---|
| Apple Developer + TestFlight | $99/yr | Up to 10,000 iOS testers |
| Ad-hoc build | $0 | ≤ 3 registered devices |
| macOS-only | $0 | Wardrobe Mac only |

Recommended: Apple Developer + TestFlight for iOS; notarised `.dmg` for macOS.

## Implementation notes

- The `/api/items` endpoint returns items with images and flags already joined
  by the Express server — no client-side joining needed.
- Flags (missing/broken) are derived from unresolved `reports` (`resolved == false`).
- The VPS is always on — no propagation delay. Pull-to-refresh reflects live data.
- Daily sync window: schedule via `BGAppRefreshTask` (iOS) so the app warms up
  even when the user hasn't opened it; fall back to on-launch check when
  background refresh is denied.
