# Store listing kit

Everything to paste into the Chrome Web Store, Microsoft Edge Add-ons, Opera Add-ons and Firefox Add-ons (AMO).
Upload file: `dist/better-steel-run-<version>.zip` (build it with `build.ps1`). The same zip works in all four stores.

| Store | Dashboard | Fee |
|---|---|---|
| Chrome Web Store | https://chrome.google.com/webstore/devconsole | $5 one-time |
| Edge Add-ons | https://partner.microsoft.com/dashboard/microsoftedge | Free |
| Opera Add-ons | https://addons.opera.com/developer/ | Free |
| Firefox Add-ons | https://addons.mozilla.org/developers/ | Free |

## Name

```
Better Steel Run
```

## Short description / summary (Chrome max 132 chars, Firefox max 250)

```
Swap the ending theme of JoJo's Steel Ball Run for your own song, synced to the video. Auto-detects the ending with AniSkip.
```

## Detailed description

```
Better Steel Run replaces the ending theme of JoJo's Bizarre Adventure: Steel Ball Run episodes with a song you choose, perfectly synced to the video.

When the ending starts, the extension mutes the player and plays your MP3 instead. Pause, seek, change speed or volume and your song follows along. Skip out of the ending and the original audio comes right back.

FEATURES
• Your song: upload any MP3 from your computer.
• Automatic: finds the exact start of the ending using AniSkip's community-voted timestamps.
• "Outro starts now": no timestamps for an episode yet? Press it once when the ending begins and it's remembered for the whole show.
• Share: press "Outro ends now" to submit the timestamps to AniSkip, after a confirmation, so everyone else gets them too.
• Smart: only Steel Ball Run episodes are touched. Ads, previews and every other show play normally.
• Themed popup with a spinning steel ball and a To Be Continued arrow.

PRIVACY
No account, no analytics, no ads. Your song and settings stay in your browser. On Steel Ball Run pages only, the show name is looked up on AniList and the episode's timestamps are fetched from AniSkip. Nothing is shared without your confirmation.

Open source (MIT): https://github.com/Sa9fon/better-steel-run
Songs are not included; bring your own MP3.

This is an unofficial fan project, not affiliated with or endorsed by the creators or publishers of JoJo's Bizarre Adventure, or by any streaming service.
```

## Category

- Chrome: **Entertainment**
- Edge: **Entertainment**
- Opera: **Entertainment**
- Firefox: **Photos, Music & Videos**

## Images (all in this folder; regenerate with `render.ps1`)

| Store | Field | File |
|---|---|---|
| Chrome | Screenshots (1280×800) | `chrome-screenshot-1.png`, `-2.png`, `-3.png` |
| Chrome | Small promo tile (440×280) | `promo-tile-440x280.png` |
| Chrome | Marquee promo tile (1400×560, optional) | `marquee-1400x560.png` |
| Chrome | Store icon (128×128) | `../icons/icon128.png` |
| Edge | Logo (300×300) | `logo-300x300.png` |
| Edge | Screenshots (1280×800) | `chrome-screenshot-*.png` |
| Edge | Small promotional tile (440×280) | `promo-tile-440x280.png` |
| Opera | Screenshots (612×408) | `opera-screenshot-1.png`, `-2.png` |
| Opera | Icon (64 or 128) | `../icons/icon128.png` |
| Firefox | Screenshots (any size) | `chrome-screenshot-*.png` |

## Privacy policy URL

```
https://github.com/Sa9fon/better-steel-run/blob/main/PRIVACY.md
```

## Homepage / support URL

```
https://github.com/Sa9fon/better-steel-run
https://github.com/Sa9fon/better-steel-run/issues
```

## Chrome: "Privacy practices" tab

**Single purpose**

```
Replaces the ending theme music of JoJo's Bizarre Adventure: Steel Ball Run episodes with an audio file chosen by the user, synchronized to the video.
```

**Permission justifications**

- **storage**
  ```
  Saves the user's settings (chosen track, fallback timing), the MP3 file they upload, and per-show ending timestamps they mark.
  ```
- **activeTab**
  ```
  Lets the popup's "Outro starts now" / "Outro ends now" buttons read the playback position of the video in the current tab.
  ```
- **Host permission (content script on all URLs)**
  ```
  Streaming sites play video inside embedded player iframes served from many different, frequently changing domains, so the content script must be able to run in those frames to mute the video and play the user's song in sync. The script stays inactive unless the top page is a supported streaming site and the episode is JoJo's Steel Ball Run; it does not read or transmit anything on other pages.
  ```
- **Remote code:** No, I am not using remote code.

**Data usage** (tick these, then all three certifications)

- ☑ **Website content:** the show name and episode number read from Steel Ball Run episode pages are sent to AniList and AniSkip to look up the ending's timestamps.
- Everything else: unticked.
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Firefox (AMO) notes

- The manifest already declares `data_collection_permissions: websiteContent` and the add-on ID `better-steel-run@sa9fon`.
- **Source code:** not required. No minification, bundler or build tool is used; the zip *is* the source.
- **Notes to reviewer:**
  ```
  No build step: the uploaded files are the source. The content script runs in all frames because video players are embedded iframes on changing domains; it only activates on supported streaming sites for Steel Ball Run episodes. Firefox asks the user to grant site access from the popup ("Grant access").
  ```

## Edge / Opera notes to reviewers

```
The extension replaces the ending theme audio of Steel Ball Run episodes with a user-provided MP3. To test: open the popup, choose "Custom Local File", upload any MP3 and Save; then play a Steel Ball Run episode on a supported site and seek to the last 2 minutes. No account is needed.
```
