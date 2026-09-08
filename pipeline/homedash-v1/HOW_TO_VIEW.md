## Seeing homedash v1 locally

### First-time setup

1. Open Terminal and change to the homedash project folder.

2. Install Node.js 22 or newer if it is not already installed. Then install homedash's packages:

   ```sh
   npm install
   ```

3. Create the two private configuration files from their examples:

   ```sh
   cp .env.example .env
   cp config/bookmarks.example.json config/bookmarks.json
   ```

4. Open `.env` in a text editor. Add your home latitude and longitude for the fallback location. If SnowRaven and llmdash do not run on the same machine as homedash, replace their loopback URLs with their private tailnet URLs.

5. Open `config/bookmarks.json` in a text editor. Each line has a group, name, and URL. Reorder the entries by moving whole lines; homedash shows them in file order after the next page reload.

### Start homedash

1. Build and run the production app:

   ```sh
   npm run build && npm start
   ```

2. On the same machine, open [http://127.0.0.1:1910](http://127.0.0.1:1910).

3. The browser asks for location permission. Allow it to use the device's current location. If permission is unavailable, homedash uses a last-known location from the previous seven days, then the home location in `.env`.

4. Use Dawn or Dense at the top to change the layout. Use System, Light, or Dark to change the appearance. Both choices are saved only in that browser, so every device can keep its own setup.

5. In Birding pulse, switch among Lifers, Photo, and Audio. Every category is ordered closest-first. The large species figure compares this month's distinct eBird species through today with the same date range last year.

6. Use Location to ask for the device's location again. Use Refresh to reload weather, bookmarks, eBird, and llmdash without reloading the page.

### Open it from another tailnet device

1. On the Pi, edit `.env` and set `HOMEDASH_HOST` to the Pi's Tailscale IPv4 address. Keep `HOMEDASH_PORT=1910`.

2. Restart homedash with `npm run build && npm start`.

3. From a device connected to the same tailnet, open `http://<pi-tailscale-ip>:1910`, replacing the placeholder with the Pi's address.

4. Browsers normally allow precise geolocation only on HTTPS pages or localhost. To use each remote device's current location, expose the loopback service through Tailscale HTTPS and open that HTTPS address. Without HTTPS, the page remains usable and falls back to its eligible last-known or configured home location.

When homedash is working, weather and daylight identify the chosen location source, bird targets show their nearest sightings first, coding headroom names both windows and reset times, and bookmark changes appear after a reload.
