# PTAG Props — Swift App Plan (iOS + macOS)

## Overview

A SwiftUI multiplatform app (iOS 17+, macOS 14+) for browsing the PTAG Props
inventory **offline-first**, with a local-only **Picking List** feature.

Phase 1: read-only, offline-capable browse + picking list.
Phase 2 (optional): admin write support via the Express server.

## Data source

| Resource | URL |
|---|---|
| Inventory JSON | `https://jappleby064.github.io/ptag-props/inventory.json` |
| Images | `https://jappleby064.github.io/ptag-props/uploads/<filename>` |

Base URL is configurable in Settings so staff can also point at the LAN server
(`http://<laptop>.local:3000`) during tech week.

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
- `Item`, `ItemImage`, `ItemReport`, `PickingListEntry` as `@Model` classes.
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
    PickingListEntry.swift        // @Model — local-only
    SyncMetadata.swift
  Networking/
    InventoryClient.swift         // async fetchItems() with ETag support
    ImagePrefetcher.swift         // background primary-image warm-up
    AuthClient.swift              // (Phase 2)
  Sync/
    SyncCoordinator.swift         // schedules daily + on-launch sync
  ViewModels/
    InventoryStore.swift          // @Observable
    PickingListStore.swift        // @Observable, CRUD on PickingListEntry
  Views/
    ContentView.swift             // TabView: Browse / Picking List / Settings
    BrowseView.swift              // searchable list, type filter
    ItemDetailView.swift          // gallery, fields, "Add to Picking List"
    PickingListView.swift         // list of saved entries, share/export
    PickingListExportView.swift   // PDF generation (A4, multi-item per page)
    SettingsView.swift            // base URL, last-synced, force resync
  Resources/
    Assets.xcassets
```

## Picking List feature (app-only)

Local-only list of asset IDs the user wants to pick. Survives app restarts;
never synced to the server.

- **Add** — "Add to Picking List" button on `ItemDetailView` and a quick-add
  swipe action on each row in `BrowseView`.
- **Manage** — dedicated `PickingListView` tab: reorderable list, swipe-to-
  remove, "Clear All" with confirm.
- **Multiple lists (stretch goal)** — name a list ("Act 1 Scene 3"), switch
  between named lists. Single unnamed list is sufficient for MVP.
- **Export** — share sheet → "Export PDF" reuses the same A4 layout as the
  website (image, asset ID, name, location, storage; multiple per page).
  Generated via `PDFKit` / `UIGraphicsPDFRenderer`.
- **Storage** — `PickingListEntry { id: UUID, assetId: String, addedAt: Date,
  listName: String? }`. Resolved against the local `Item` cache at render time
  so a stale entry whose item was deleted shows a "no longer in inventory"
  placeholder rather than crashing.

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

1. Tab bar: Browse / Picking List / Settings
2. Type filter (All / Props / Furniture / Costumes), searchable
3. Item detail with image gallery, flag badges (missing/broken)
4. Pull-to-refresh + background daily sync
5. Offline image cache; placeholder when an image hasn't been prefetched yet
6. Picking List CRUD + PDF export
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

- `inventory.json` is `{ admins, items, images, categories, storage_areas,
  reports, counters, nextId }`. Decode the full struct; the app uses `items`,
  `images`, `reports`.
- Flags (missing/broken) are derived from unresolved `reports` (`resolved == false`).
- GitHub Pages propagation after admin save takes ~30 s.
- Daily sync window: schedule via `BGAppRefreshTask` (iOS) so the app warms up
  even when the user hasn't opened it; fall back to on-launch check when
  background refresh is denied.
