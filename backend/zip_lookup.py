"""
ZIP to lat/lng lookup for company map and import.
Uses zipcodes package (US data bundled, no API key).
"""

def lookup_zip(zip_code: str):
    """Return {city, state, lat, lng} or None if ZIP not found."""
    if not zip_code or not str(zip_code).strip():
        return None
    raw = str(zip_code).strip()
    # Normalize: use first 5 digits for US ZIP
    if len(raw) >= 5:
        raw = raw[:5]
    try:
        import zipcodes
        matches = zipcodes.matching(raw)
        if not matches:
            return None
        r = matches[0]
        lat = r.get("lat")
        lng = r.get("long")  # zipcodes uses 'long' not 'lng'
        if lat is None or lng is None:
            return None
        return {
            "city": r.get("city"),
            "state": r.get("state"),
            "lat": float(lat),
            "lng": float(lng),
        }
    except Exception:
        return None
