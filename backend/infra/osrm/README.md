# osrm — routing engine data (§12, P17)

Self-hosted OSRM provides walk/drive travel times feeding the solver (§5.7).
This directory holds the per-region `.osrm*` extract files mounted into the
`osrm` service in `../docker-compose.dev.yml` (profile `osrm`). **P00 reserves
the directory only** — the real extract pipeline lands in P17.

## Building an extract (MLD pipeline, later)

Pick an OSM extract (e.g. a Geofabrik region `.osm.pbf`), then run the three
MLD stages with the same OSRM image the compose file uses:

```bash
cd backend/infra
# 1. extract with a profile (foot.lua for walking, car.lua for driving)
docker run --rm -v "$PWD/osrm:/data" osrm/osrm-backend \
  osrm-extract -p /opt/foot.lua /data/region.osm.pbf
# 2. partition
docker run --rm -v "$PWD/osrm:/data" osrm/osrm-backend \
  osrm-partition /data/region.osrm
# 3. customize
docker run --rm -v "$PWD/osrm:/data" osrm/osrm-backend \
  osrm-customize /data/region.osrm

# then serve (matches the compose command):
#   osrm-routed --algorithm mld /data/region.osrm
docker compose -f docker-compose.dev.yml --profile osrm up -d osrm
```

Notes:
- The serving `--algorithm mld` must match the partition/customize (MLD)
  pipeline above. (The alternative CH pipeline uses `osrm-contract` + `--algorithm ch`.)
- RAM scales with loaded region size (§12.1: OSRM is the main variable, ~1–4 GB).
- `.osm.pbf` and generated `.osrm*` artifacts are gitignored — never commit them.
