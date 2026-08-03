import requests
import json
from datetime import datetime

url = "https://raw.githubusercontent.com/Robotaxi-Tracker/robotaxi-service-areas/main/dist/service-areas.json"
r = requests.get(url)
data = r.json()

tesla_features = []
for area in data.get("areas", []):
    if area.get("provider") == "tesla" and "boundary" in area:
        feature = area["boundary"]
        if "properties" not in feature:
            feature["properties"] = {}
        feature["properties"]["name"] = area.get("name", "Unknown")
        feature["properties"]["provider"] = "tesla"
        tesla_features.append(feature)

fc = {
    "type": "FeatureCollection",
    "features": tesla_features,
    "properties": {"updated": datetime.utcnow().isoformat() + "Z"}
}

with open("/Users/djrmacmini/.openclaw/workspace/occab-repo/site/tesla_areas.geojson", "w") as f:
    json.dump(fc, f)

print(f"Saved {len(tesla_features)} Tesla areas to tesla_areas.geojson")
