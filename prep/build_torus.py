"""Build the source-attributed Torus facts file from reviewed constants."""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep._paths import PUBLIC_DATA  # noqa: E402
from prep.jsonio import write_json  # noqa: E402

RETRIEVED = "2026-10-26"
LICENSE = "Torus public web page, facts only, no text copied"

SOURCE_URLS = {
    "torus_rmp_case_study": "https://www.torus.co/case-studies/case-studies-rocky-mountain-power",
    "torus_rmp_event_heatmap": "https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg",
    "torus_rmp_event_response": "https://www.datocms-assets.com/93357/1778882593-unplanned-ffr-rmp-1.jpg",
    "torus_flywheel": "https://www.torus.co/torus-flywheel",
    "torus_nova_pulse": "https://www.torus.co/torus-nova-pulse",
    "torus_nova_station": "https://www.torus.co/torus-nova",
    "rmp_torus_first_mou": "https://www.businesswire.com/news/home/20250127668054/en/Rocky-Mountain-Power-and-Torus-Announce-Strategic-Partnership",
    "torus_expanded_mou": "https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants",
}

FACTS = {
    "events_2025_total": (359, "torus_rmp_case_study"),
    "events_2025_by_hour": ([9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8], "torus_rmp_event_heatmap"),
    "events_2025_by_weekday": ([50, 57, 43, 57, 53, 45, 54], "torus_rmp_event_heatmap"),
    "ramp_s": (19, "torus_rmp_event_response"),
    "ramp_target_s": (30, "torus_rmp_event_response"),
    "delivered_pct": (102, "torus_rmp_event_response"),
    "delivered_band_pct": ([90, 100], "torus_rmp_event_response"),
    "spin_c_rate": (10, "torus_flywheel"),
    "spin_cycle_life": (25000, "torus_flywheel"),
    "spin_discharge_recharge_min": (12, "torus_flywheel"),
    "pulse_c_rate": (0.5, "torus_nova_pulse"),
    "pulse_cycle_life": (7500, "torus_nova_pulse"),
    "pulse_life_yr": (25, "torus_nova_station"),
    "mou_mw": (70, "rmp_torus_first_mou"),
    "mou_ceiling_mw": (500, "torus_expanded_mou"),
}

NOTES = [
    "The event heatmap states no time zone; always show it read as Mountain time and as UTC.",
    "359 is the RMP case study count; Torus's 2025 wrap-up says more than 360. We use 359.",
    "pulse_life_yr is the Torus Station lifespan of 25 years, not a Pulse-specific rating.",
    "500 MW is the ceiling of the expanded MOU, not installed capacity.",
]


def build(path: Path = PUBLIC_DATA / "torus_published.json") -> None:
    sources = [
        {
            "id": source_id,
            "url": url,
            "license": LICENSE,
            "retrieved_utc": RETRIEVED,
        }
        for source_id, url in SOURCE_URLS.items()
    ]
    result = {
        key: {"value": value, "prov": "TORUS_PUBLISHED", "source_id": source_id}
        for key, (value, source_id) in FACTS.items()
    }
    result["sources"] = sources
    result["notes"] = NOTES
    write_json(path, result)
    print(f"wrote {path}: {len(FACTS)} Torus facts, {len(sources)} sources")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=PUBLIC_DATA / "torus_published.json")
    args = parser.parse_args()
    build(args.out)


if __name__ == "__main__":
    main()
