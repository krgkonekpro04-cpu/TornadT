# International tornado data in TornadT

## Japan

`japan-jma-tornadoes.json` contains JMA records whose event type is `tornado` or `tornado / funnel cloud` (JMA event codes 1 and 7). Downbursts, ambiguous tornado/downburst cases, and unrelated gust events are excluded. Coordinates and event details are normalized from JMA's published CSV. F-scale values are shown before April 2016; JEF values are shown from April 2016 onward. The source record IDs are retained in each TornadT ID.

Source: Japan Meteorological Agency, [Tornado and Other Wind Gust Database](https://www.data.jma.go.jp/stats/data/bosai/tornado/), CSV listing cases from 1961 onward. JMA's e-Gov dataset entry identifies the CSV under [Japanese Government Standard Terms of Use, version 2.0](https://www.data.e-gov.go.jp/data/en/dataset/mlit_20140919_0748). Attribution: Japan Meteorological Agency (JMA), Tornado and Other Wind Gust Database. The JMA dataset is updated by its publisher; this bundled copy is a snapshot and needs refreshing to include later revisions.

## United States

The existing NOAA SPC data file and the current-year NOAA NCEI loader remain in place. They are not replaced by the international records.

## Coverage and licensing notes

This is a multi-source database, not a complete worldwide census. JMA currently supplies the international records bundled here. Europe's ESWD limits bulk access and redistribution, and the Bureau of Meteorology's Severe Storms Archive page does not grant general redistribution rights by default. The South African and China research datasets located during source review did not provide unrestricted downloadable files suitable for this bundle. These regions are not represented yet; add their data only when a usable dataset and its terms are available.
