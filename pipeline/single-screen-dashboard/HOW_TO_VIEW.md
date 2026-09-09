## Seeing the Single-screen Dashboard locally

1. Open Terminal and change to the homedash project folder:

   ```sh
   cd /Users/developer/devwork/homedash
   ```

2. Start homedash:

   ```sh
   npm run dev
   ```

3. Keep Terminal open, then open this address in a browser:

   <http://127.0.0.1:5173>

4. Use the **Dawn** and **Dense** controls at the top to compare the two compact layouts. Use **System**, **Light**, and **Dark** to confirm appearance remains an independent device preference.

5. In Dawn, look for the date, greeting, summary, and daylight arc in one contained masthead. The summary should stay in its own left pane and never overlap the daylight details.

6. Confirm the weather, all five nearby targets, both coding-runway providers and their two quota windows, and all five bookmarks are visible on the same page without document scrolling. Dense should show the same values in its ruled scan-table layout.

7. On a phone, open the same address through the development machine’s existing private network access. At a 360×800 viewport, every normal dashboard value and each 42px category/bookmark target should remain available without document scrolling.

8. When finished, return to Terminal and press **Control-C** to stop homedash.
