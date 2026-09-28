# Privacy Policy: Better Steel Run

_Last updated: September 29, 2026_

Better Steel Run is a browser extension that replaces the ending theme of *JoJo's Bizarre Adventure: Steel Ball Run* episodes with a song you choose. This policy explains what data it handles. The short version: **no accounts, no analytics, no ads, and nothing is sold or collected by the developer.**

## Data stored on your device

These are kept in your browser's extension storage and never sent to the developer:

- **Your settings:** the chosen track and the "seconds before end" fallback. Chrome, Edge and Firefox may sync these across your own devices if you use browser sync.
- **Your uploaded MP3**, if you choose "Custom Local File". It is stored locally only and never synced or uploaded.
- **Per-show ending marks** saved with "Outro starts now".
- **A random anonymous ID**, created only the first time you share timestamps on AniSkip (see below).

## Data sent to third parties

The extension only contacts other services on web pages it identifies as a *Steel Ball Run* episode on a supported website:

| Service | What is sent | Why |
|---|---|---|
| [AniList](https://anilist.co) (`graphql.anilist.co`) | The show name read from the page, or an AniList ID linked from the page | To find the show's MyAnimeList ID |
| [AniSkip](https://aniskip.com) (`api.aniskip.com`) | The MyAnimeList ID and episode number | To fetch when the episode's ending starts and ends |

**Sharing timestamps (optional).** When you press **Outro ends now** and then confirm **Share on AniSkip**, the extension sends AniSkip the ending's start and end time, the episode length, the website's name, the MyAnimeList ID, the episode number and the random anonymous ID. This happens only after you confirm each time. Shared timestamps are public on AniSkip.

These requests are subject to the privacy policies of [AniList](https://anilist.co/terms) and [AniSkip](https://aniskip.com). No browsing history, personal information or page content beyond what is listed above is ever sent.

## Permissions

- **storage:** saves your settings, uploaded song and marks.
- **activeTab:** lets the popup's buttons talk to the video in the current tab.
- **Access to all websites:** streaming sites play video inside player frames on many changing domains, so the extension's script must be able to run inside them. It stays inactive unless the page is a supported site *and* a *Steel Ball Run* episode.

## Removing your data

Uninstalling the extension deletes everything it stored. To remove only the uploaded song, upload another one or reinstall.

## Contact

Questions or concerns: open an issue at <https://github.com/Sa9fon/better-steel-run/issues>.
