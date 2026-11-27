# Kindred Stranger Mailbox

`/mailbox.html` is a guest book for visitors to the Paradox ground. The Wizard shares the link with guests. The page is not in `catalog.js` and is marked `noindex`, so it is public but does not appear anywhere on the site.

## How a letter arrives
1. The guest writes a letter on the page and presses **Seal it and send**.
2. GitHub opens with a new file already filled in, `mailbox/letters/<date>-<name>-<code>.md`.
3. Because the guest is not a collaborator, GitHub makes them a fork and offers **Propose changes**, which opens a pull request.
4. The **Mailbox check** workflow reads the pull request. It checks the letter's front matter and length, checks photo sizes, and fails any photo that still has a GPS location in it.
5. A maintainer reads the letter and merges it, and the letter appears on the page. The page reads the folder listing from the GitHub API, so a merged letter needs no rebuild.

Guests who don't have a GitHub account can press **Copy it for the Wizard** and send the text by message. Anyone with access can then commit it as a new file in `mailbox/letters/`.

## Letter format
```
---
name: "a first name or nickname"
from: "a town or region (optional)"
visited: 2026-11        # optional, YYYY-MM
written: 2026-11-27
---

The letter, in plain text.
```

## Before merging
- Check there are no phone numbers, emails, street addresses, or full names of other people.
- Photos should show places, not people. The check removes the location risk, but it cannot tell who is in a photo.
