## Seeing Clickable Dashboard and Kagi Search locally

### Configure and start

1. Open Terminal and change to the project folder:

   ```sh
   cd /Users/developer/devwork/homedash
   ```

2. If needed, create private configuration from the public example. Keep the real llmdash browser destination only in `.env`:

   ```sh
   cp .env.example .env
   ```

3. In `.env`, set `LLMDASH_LAUNCH_URL` to the absolute HTTP(S) address that a browser should open for llmdash. This is separate from the server-to-server `LLMDASH_URL` setting.

4. Build and start the production application so CSP and the fixed launch routes are active:

   ```sh
   npm run build && npm start
   ```

5. Open <http://127.0.0.1:1910>.

### What to verify

1. The compact Kagi field should have focus once when the page opens. Type without submitting, switch between Dawn and Dense or change appearance, and confirm the query stays in the same field and focus is not reclaimed.

2. Submit a non-empty query with Enter or the arrow control to perform a normal same-tab Kagi GET search. A blank or whitespace-only submission should stay on homedash and show `Enter a search before going to Kagi.`

3. In Birding pulse, activate the month comparison to open My eBird. Activate a target row to open the map for that row's canonical species code. Both are ordinary same-tab links.

4. In Coding runway, activate the underlined llmdash identity. The affordance remains visible even if quota data is loading or unavailable. If `LLMDASH_LAUNCH_URL` is missing or invalid, only that explicit navigation returns a safe configuration error.

5. Compare Dawn and Dense. Both should show the same fixed destinations, `31 mi` for the unchanged 50 km radius, and consistently formatted target distances.

6. At 1440×900 and 360×800, confirm the normal five-target/five-bookmark payload has no document scrolling or clipped source region. On phone, search, toolbar controls, target rows, source links, and bookmarks retain their mobile touch size.

7. When finished, press **Control-C** in Terminal.
