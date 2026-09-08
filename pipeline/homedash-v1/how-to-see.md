## Seeing homedash v1

### First-time setup on the host or Pi

1. Open a terminal in the homedash project folder. When the project is on the Pi, connect to the Pi over SSH first and change into that folder.

2. Install Node.js 22 or newer if needed, then install the project packages:

   ```sh
   npm install
   ```

3. Create the private configuration files from their examples:

   ```sh
   cp .env.example .env
   cp config/bookmarks.example.json config/bookmarks.json
   ```

4. Open `.env` in a text editor. Keep `HOMEDASH_PORT=1910`. Add `HOME_LATITUDE`, `HOME_LONGITUDE`, and `HOME_LABEL` for the final location fallback. SnowRaven defaults to `http://127.0.0.1:1620` and llmdash defaults to `http://127.0.0.1:8787`; change either private URL only when that service runs elsewhere.

5. Open `config/bookmarks.json`. Each entry has a group, name, and URL. Move whole entries to reorder them; homedash uses file order after the next page reload.

### Start it

1. Build and start the production app:

   ```sh
   npm run build && npm start
   ```

2. On the host itself, open [http://127.0.0.1:1910](http://127.0.0.1:1910).

3. Allow location access when the browser asks. Homedash tries the device's current location first, a last-known location from the previous seven days second, and the configured home location last.

### Open it over the tailnet

The supported Pi path is the idempotent installer at `scripts/install-or-update.sh`. The same command handles first installation and future updates: it preserves `.env` and `config/bookmarks.json`, runs the full local checks, builds production assets, installs a restart-on-failure systemd user service, and adds a dedicated Tailscale HTTPS listener on port `1910` without replacing other Serve routes.

Because the repository is private, the Pi must have an SSH key authorized for the GitHub repository. Run the one-line clone-or-update command supplied with the deployment from the Pi shell.

After the script reports a healthy service, open the HTTPS URL printed by Tailscale Serve from any device on the tailnet. HTTPS is required for each remote browser to request its own current location.

To change bookmarks later, edit `config/bookmarks.json` on the Pi and reload the page. To change private upstreams or the Home fallback, edit `.env` and run the same one-line command again.

### What to inspect

1. Weather should show the chosen location source, current conditions, high and low, precipitation, sunrise, and sunset.

2. Birding should show this month's distinct species against the same period last year. Lifers, Photo, and Audio must each be ordered closest-first.

3. Coding runway should show Claude and Codex five-hour and weekly remaining headroom, plus reset times when llmdash supplies them.

4. Bookmarks should follow the order in `config/bookmarks.json`.

5. Dawn or Dense and System, Light, or Dark should switch immediately and remain saved in that browser. A second browser or device keeps its own choices.

6. Location retries geolocation. Refresh reloads the dynamic sources without reloading the page, and one failed source should not hide the others.
