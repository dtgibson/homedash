## Seeing Moon Phase Near Sunrise and Sunset locally

1. Open a terminal in the `homedash` project folder.

2. Start the development server:

   ```sh
   npm run dev
   ```

3. Open your browser and go to:

   `http://localhost:5173`

4. In Dawn view, look at the daylight treatment to the right of the greeting. Beneath the sunrise, daylight, and sunset line, you should see `Moon ·` followed by the current named phase.

5. Select `Dense` in the top toolbar. In the Weather row, the same phase name should appear after the sunrise, sunset, and daylight summary.

6. Try `System`, `Light`, and `Dark`, then use `Refresh`. The phase remains the same meaning across presentations and appearances and does not appear as a fifth source or gain its own loading, stale, error, or refresh control.

7. To stop the local server, return to the terminal and press `Control-C`.
