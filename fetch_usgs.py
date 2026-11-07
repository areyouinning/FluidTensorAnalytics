#!/usr/bin/env python3
"""Download one water year of daily mean discharge from a USGS gage, as CSV for the Hydrograph Synth.

    python fetch_usgs.py 09241000 2023          # writes usgs_09241000_wy2023.csv

A water year runs from 1 October of the year before to 30 September (WY 2023 = 2022-10-01 .. 2023-09-30).
Output columns: date (YYYY-MM-DD), discharge_cfs. Days the gage did not report are left out;
the synth fills short gaps by linear interpolation.

Uses only the Python standard library. Tries the USGS Water Data OGC API first, then the legacy
NWIS daily-values service. Parameter 00060 is discharge in cubic feet per second; statistic 00003 is the daily mean.
"""
import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

OGC = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items"
NWIS = "https://waterservices.usgs.gov/nwis/dv/"
UA = {"User-Agent": "fetch_usgs.py (Hydrograph Synth)"}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def water_year(wy):
    return f"{wy - 1}-10-01", f"{wy}-09-30"


def parse_ogc_page(text):
    """One page of OGC API GeoJSON: returns ({date: value}, next_url or None)."""
    doc = json.loads(text)
    rows = {}
    for f in doc.get("features", []):
        p = f.get("properties", {})
        day, val = str(p.get("time", ""))[:10], p.get("value")
        try:
            v = float(val)
        except (TypeError, ValueError):
            continue
        if len(day) == 10 and v >= 0:
            rows[day] = v
    nxt = next((l.get("href") for l in doc.get("links", []) if l.get("rel") == "next"), None)
    return rows, nxt


def from_ogc(site, wy, fetch=get):
    start, end = water_year(wy)
    q = urllib.parse.urlencode({"monitoring_location_id": f"USGS-{site}", "parameter_code": "00060",
                                "statistic_id": "00003", "time": f"{start}/{end}", "f": "json", "limit": 1000})
    url, rows, pages = f"{OGC}?{q}", {}, 0
    while url and pages < 20:
        got, url = parse_ogc_page(fetch(url))
        rows.update(got)
        pages += 1
    return rows


def parse_rdb(text):
    """NWIS RDB: tab-separated, '#' comments, a header row, a column-format row, then data.
    The discharge column is the one ending in _00060_00003; its neighbour ending in _cd holds quality codes."""
    lines = [l for l in text.splitlines() if l and not l.startswith("#")]
    if len(lines) < 3:
        return {}
    head = lines[0].split("\t")
    col = next((i for i, h in enumerate(head) if h.endswith("_00060_00003")), None)
    if col is None or "datetime" not in head:
        return {}
    di, rows = head.index("datetime"), {}
    for l in lines[2:]:
        t = l.split("\t")
        if len(t) <= col:
            continue
        try:
            v = float(t[col])
        except ValueError:            # Ice, Eqp, Ssn and other no-value flags
            continue
        if v >= 0:
            rows[t[di][:10]] = v
    return rows


def from_nwis(site, wy, fetch=get):
    start, end = water_year(wy)
    q = urllib.parse.urlencode({"format": "rdb", "sites": site, "parameterCd": "00060", "statCd": "00003",
                                "startDT": start, "endDT": end, "siteStatus": "all"})
    return parse_rdb(fetch(f"{NWIS}?{q}"))


def fetch_year(site, wy, fetch=get, log=print):
    for name, fn in (("USGS Water Data OGC API", from_ogc), ("NWIS daily values", from_nwis)):
        try:
            rows = fn(site, wy, fetch)
        except (urllib.error.URLError, OSError, ValueError) as e:
            log(f"{name}: {e}")
            continue
        if rows:
            log(f"{name}: {len(rows)} days")
            return rows
        log(f"{name}: no daily discharge for USGS {site} in WY {wy}")
    return {}


def write_csv(rows, path):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "discharge_cfs"])
        for day in sorted(rows):
            w.writerow([day, f"{rows[day]:g}"])


def main(argv):
    if len(argv) != 3 or not argv[1].isdigit() or not argv[2].isdigit():
        print(__doc__.strip().splitlines()[2].strip())
        return 2
    site, wy = argv[1], int(argv[2])
    rows = fetch_year(site, wy)
    if not rows:
        print("Nothing downloaded. Check the site number and year at https://waterdata.usgs.gov/")
        return 1
    path = f"usgs_{site}_wy{wy}.csv"
    write_csv(rows, path)
    print(f"Wrote {path}: {len(rows)} days. Load it with 'Load gage file…' or drop it on the page.")
    if len(rows) < 300:
        print("Warning: the synth needs at least 300 days in the water year.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
