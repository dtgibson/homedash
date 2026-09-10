## Seeing Tide and Daylight Graphic locally

1. Open a terminal in the Homedash project folder.

2. If the project does not have a `.env` file yet, create one from `.env.example`. In `.env`, set `TIDE_STATION_ID` to the identifier for the NOAA Tides & Currents station you want Homedash to use. You may also replace `Local tide` in `TIDE_STATION_LABEL` with the place name you want displayed.

3. Install the project's packages if this is your first local run:

   `npm install`

4. Start the development server:

   `npm run dev`

5. Open your browser and go to:

   `http://127.0.0.1:5173`

6. In Dawn, look at the right side of the greeting. The daylight arc and tide curve should share one graphic. Below it, confirm you can see the current tide height, whether it is observed or predicted, its direction, the next high or low with its time, the station label, `MLLW`, moon phase, and an update state.

7. Open Settings, choose Dense, and close Settings. Confirm the weather row shows the same tide height, basis, direction, next turn, station, and datum, with a small tide trace at the end.

8. Use the main refresh control. Its accessible progress should include five sources, and the tide facts should remain visible while tide refreshes. If tide alone fails, use its **Try again** control; the other dashboard sources should not restart.

9. To inspect the unavailable state, stop the server, clear `TIDE_STATION_ID` in `.env`, and run `npm run dev` again. Daylight, moon, weather, bookmarks, eBird, and llmdash should remain available while the tide area reports that tide is unavailable.

