## Seeing Instant Cached Data Refresh locally

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

4. If the browser asks for location access, choose the option you normally use. Weather and eBird should resolve independently from bookmarks and coding runway.

5. Wait until the four source lines say `Up to date`, then reload the browser tab. The saved weather, bookmarks, eBird targets, and coding-runway values should appear immediately while their source lines briefly say `Refreshing`; none should turn into an empty loading block.

6. Use the **Refresh** control at the top. Its desktop label reports progress such as `Refreshing 2/4`, while each source changes to `Up to date` on its own schedule. Existing values, links, target order, bookmark order, and location wording should stay visible until a valid replacement arrives.

7. Switch between **Dawn** and **Dense**, change appearance, or select another eBird target category during a refresh. The same values and source states should carry across without restarting the work or resetting the category.

8. If one of the private upstream sources is unavailable, its saved values should remain readable under `Refresh failed`, with a **Try again** action for that source. Other sources should continue updating normally. A source with no saved reading still uses its normal source-specific loading or error treatment.

9. At a 360×800 phone-sized window and a 1440×900 desktop window, the normal five-target/five-bookmark dashboard should remain one screen in both renderers.

10. When finished, return to Terminal and press **Control-C** to stop homedash.
