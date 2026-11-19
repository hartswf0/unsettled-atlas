# Abyssinian Highlands

A field atlas of the Ethiopian Highlands and Blue Nile basin from open data. First pass: eight 12 km windows
(seven sites plus Yosemite Valley as a relief reference).

- `web/` — the page (`index.html` for GitHub Pages, `artifact.html` for the published artifact), imagery, `sites.json`
- `src/fetch.py <site>` — Sentinel-2 (two seasons), Copernicus GLO-30 DEM, FTW field polygons for one site
- `src/build.py` — imagery, outline overlays, measured statistics, relief transects
- `SCION_ABYSSINIAN_HIGHLANDS.md` — the system instruction this atlas runs under

Data: Copernicus Sentinel-2 L2A (AWS `sentinel-cogs`), Copernicus DEM GLO-30, Fields of the World global
field boundaries (Robinson et al. 2026, arXiv:2605.11055, CC BY 4.0). Raw downloads are not committed.
