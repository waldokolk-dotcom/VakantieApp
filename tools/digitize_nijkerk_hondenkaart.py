#!/usr/bin/env python3
"""Digitize the official 2026 Nijkerk dog-walking PDF into GeoJSON.

Source: Gemeente Nijkerk, Honden-uitlaatkaart Nijkerk, college decision 3 March 2026.
The script downloads the official PDF, renders it, detects the municipal bright-blue
losloop polygons and georeferences them against labelled map control points.

Output is explicitly a derived digital layer, not source GIS data from the municipality.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import urllib.request
from pathlib import Path

import cv2
import fitz  # PyMuPDF
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "whatsup-dog" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT_DIR / "nijkerk-hondenuitlaatkaart-2026.pdf"
GEOJSON_PATH = OUT_DIR / "nijkerk-losloopgebieden.geojson"
REPORT_PATH = OUT_DIR / "digitize-report.json"

PDF_URL = "https://cuatro.sim-cdn.nl/nijkerk/uploads/2.2%20Hondenuitlaatkaart%20Nijkerk%20jan%202026.pdf?cb=-utJx3kH"
SOURCE_PAGE = "https://www.nijkerk.eu/hondenbeleid"

# Control points: geographic positions of clearly labelled places/streets visible on
# the municipal PDF. Several points are used so one imperfect street label does not
# determine the transformation.
CONTROL_POINTS = {
    "station": (52.22203, 5.49352),
    "marishof": (52.2140797, 5.4972254),
    "bramenhof": (52.2193080, 5.4990967),
    "nachtegaalsteeg": (52.22456, 5.49820),
    "slichtenhorsterweg": (52.20886, 5.48317),
    "middachtenstraat": (52.217182, 5.475982),
    "amersfoortseweg": (52.2078973, 5.4733756),
}

# Safe fallback georeference of the map frame, calibrated against Station Nijkerk and
# several labelled streets. Used only if PDF text extraction cannot produce a stable fit.
FALLBACK_MAP_FRAME = {
    "left": 0.0275,
    "top": 0.101,
    "right": 0.738,
    "bottom": 0.952,
    "west": 5.4280,
    "east": 5.5140,
    "north": 52.2477,
    "south": 52.2000,
}


def download_pdf() -> None:
    req = urllib.request.Request(
        PDF_URL,
        headers={"User-Agent": "Whatsup-dog-map-digitizer/1.0 (+https://github.com/waldokolk-dotcom/VakantieApp)"},
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        data = response.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError("Official map download did not return a PDF")
    PDF_PATH.write_bytes(data)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("’", "").replace("'", ""))


def find_control_words(page: fitz.Page):
    words = page.get_text("words")
    candidates = []
    for x0, y0, x1, y1, text, *_ in words:
        t = norm(text)
        if not t:
            continue
        for key, (lat, lon) in CONTROL_POINTS.items():
            if key in t or t in key:
                # Exclude legend/title area: controls must lie in the main map.
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                if cx < page.rect.width * 0.78 and cy > page.rect.height * 0.10:
                    candidates.append({"key": key, "x": cx, "y": cy, "lat": lat, "lon": lon, "text": text})
    # Keep one occurrence per key. For repeated street names choose the point closest to
    # the map centre, which is generally the cartographic label rather than a legend item.
    chosen = []
    for key in CONTROL_POINTS:
        hits = [c for c in candidates if c["key"] == key]
        if not hits:
            continue
        cx, cy = page.rect.width * 0.42, page.rect.height * 0.55
        hit = min(hits, key=lambda c: (c["x"] - cx) ** 2 + (c["y"] - cy) ** 2)
        chosen.append(hit)
    return chosen


def robust_linear(values, targets):
    """Fit y=a*x+b while trimming one gross outlier when useful."""
    x = np.asarray(values, dtype=float)
    y = np.asarray(targets, dtype=float)
    if len(x) < 2:
        return None
    keep = np.ones(len(x), dtype=bool)
    for _ in range(3):
        a, b = np.polyfit(x[keep], y[keep], 1)
        pred = a * x + b
        resid = np.abs(pred - y)
        if keep.sum() <= 4:
            break
        med = np.median(resid[keep]) or 1e-9
        worst = int(np.argmax(np.where(keep, resid, -1)))
        if resid[worst] > max(med * 3.5, 0.0014):
            keep[worst] = False
        else:
            break
    a, b = np.polyfit(x[keep], y[keep], 1)
    rms = float(np.sqrt(np.mean((a * x[keep] + b - y[keep]) ** 2)))
    return float(a), float(b), rms, keep.tolist()


def build_georef(page: fitz.Page, controls):
    lon_fit = robust_linear([c["x"] for c in controls], [c["lon"] for c in controls])
    lat_fit = robust_linear([c["y"] for c in controls], [c["lat"] for c in controls])
    if lon_fit and lat_fit and lon_fit[2] < 0.0018 and lat_fit[2] < 0.0018:
        return {
            "mode": "label-fit",
            "lon_a": lon_fit[0], "lon_b": lon_fit[1],
            "lat_a": lat_fit[0], "lat_b": lat_fit[1],
            "lon_rms_deg": lon_fit[2], "lat_rms_deg": lat_fit[2],
        }

    f = FALLBACK_MAP_FRAME
    left, right = page.rect.width * f["left"], page.rect.width * f["right"]
    top, bottom = page.rect.height * f["top"], page.rect.height * f["bottom"]
    return {
        "mode": "calibrated-map-frame",
        "lon_a": (f["east"] - f["west"]) / (right - left),
        "lon_b": f["west"] - ((f["east"] - f["west"]) / (right - left)) * left,
        "lat_a": (f["south"] - f["north"]) / (bottom - top),
        "lat_b": f["north"] - ((f["south"] - f["north"]) / (bottom - top)) * top,
        "lon_rms_deg": None, "lat_rms_deg": None,
    }


def georef_point(x_pdf: float, y_pdf: float, g):
    lon = g["lon_a"] * x_pdf + g["lon_b"]
    lat = g["lat_a"] * y_pdf + g["lat_b"]
    return [round(float(lon), 7), round(float(lat), 7)]


def polygon_area_m2(coords):
    # local equirectangular approximation, sufficient for QC
    if len(coords) < 4:
        return 0.0
    lat0 = math.radians(sum(c[1] for c in coords) / len(coords))
    pts = [(math.radians(c[0]) * 6371000 * math.cos(lat0), math.radians(c[1]) * 6371000) for c in coords]
    area = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def extract_blue_polygons(page: fitz.Page, georef):
    scale = 4.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    rgb = img[:, :, :3]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Municipal off-leash blue is a bright, saturated cyan. The upper V bound excludes
    # dark-blue labels such as the large word NIJKERK; the crop excludes the legend.
    mask = cv2.inRange(hsv, np.array([82, 130, 175]), np.array([108, 255, 255]))

    h, w = mask.shape
    crop = np.zeros_like(mask)
    f = FALLBACK_MAP_FRAME
    x0, x1 = int(w * f["left"]), int(w * f["right"])
    y0, y1 = int(h * f["top"]), int(h * f["bottom"])
    crop[y0:y1, x0:x1] = 255
    mask = cv2.bitwise_and(mask, crop)

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    features = []
    debug_contours = []
    for contour in contours:
        area_px = cv2.contourArea(contour)
        if area_px < 110:
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 5 or bh < 5:
            continue
        # Ignore title-like components in the top-right zone.
        if x > w * 0.57 and y < h * 0.31 and bh < h * 0.07:
            continue
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, max(1.5, 0.004 * peri), True)
        if len(approx) < 3:
            continue
        coords = []
        for p in approx[:, 0, :]:
            x_pdf, y_pdf = float(p[0]) / scale, float(p[1]) / scale
            coords.append(georef_point(x_pdf, y_pdf, georef))
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        area_m2 = polygon_area_m2(coords)
        # Remove residual letter/annotation fragments and huge false positives.
        if area_m2 < 25 or area_m2 > 120000:
            continue
        debug_contours.append({"pixel_area": float(area_px), "area_m2": round(area_m2, 1), "bbox": [x, y, bw, bh]})
        features.append({
            "type": "Feature",
            "properties": {
                "category": "losloopgebied",
                "source": "Gemeente Nijkerk",
                "source_url": SOURCE_PAGE,
                "source_map": PDF_URL,
                "source_decision": "collegebesluit 3 maart 2026",
                "digitalisation": "Whatsup dog",
                "status": "gedigitaliseerd van officiële kaart",
                "area_m2_approx": round(area_m2, 1),
            },
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })

    # Stable ordering north-to-south / west-to-east for IDs.
    def centroid(feature):
        pts = feature["geometry"]["coordinates"][0][:-1]
        return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)
    features.sort(key=lambda ftr: (-centroid(ftr)[0], centroid(ftr)[1]))
    for i, feature in enumerate(features, start=1):
        feature["properties"]["id"] = f"nijkerk-losloop-{i:02d}"
        feature["properties"]["name"] = f"Losloopgebied {i}"
    return features, debug_contours


def main():
    download_pdf()
    doc = fitz.open(PDF_PATH)
    if doc.page_count != 1:
        raise RuntimeError(f"Expected one-page official map, got {doc.page_count}")
    page = doc[0]
    controls = find_control_words(page)
    georef = build_georef(page, controls)
    features, debug_contours = extract_blue_polygons(page, georef)

    # QC gate: Nijkerk's official policy material describes a finite set of off-leash
    # locations. Fail rather than publishing a nonsensical extraction.
    if not (8 <= len(features) <= 30):
        report = {"ok": False, "reason": "unexpected feature count", "feature_count": len(features), "controls": controls, "georef": georef, "contours": debug_contours}
        REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        raise RuntimeError(f"QC failed: extracted {len(features)} blue components")

    geojson = {
        "type": "FeatureCollection",
        "name": "nijkerk-losloopgebieden-2026",
        "properties": {
            "source": "Gemeente Nijkerk",
            "source_url": SOURCE_PAGE,
            "source_map": PDF_URL,
            "decision_date": "2026-03-03",
            "digitalisation": "Whatsup dog",
            "status": "afgeleid van officiële honden-uitlaatkaart; geen gemeentelijke bron-GIS",
        },
        "features": features,
    }
    GEOJSON_PATH.write_text(json.dumps(geojson, indent=2, ensure_ascii=False), encoding="utf-8")
    report = {
        "ok": True,
        "feature_count": len(features),
        "pdf_page": [page.rect.width, page.rect.height],
        "controls": controls,
        "georef": georef,
        "contours": debug_contours,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
