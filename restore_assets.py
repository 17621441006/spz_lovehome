"""Restore the two losslessly packed GLB assets before serving dist/."""
from pathlib import Path
import gzip, hashlib, json
ROOT = Path(__file__).resolve().parent

def restore():
    for entry in json.loads((ROOT / "packed-assets/manifest.json").read_text()):
        target = ROOT / entry["path"]
        if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == entry["sha256"]:
            continue
        data = gzip.decompress((ROOT / entry["packed"]).read_bytes())
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError("Asset verification failed: " + entry["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_bytes(data)
        temporary.replace(target)
        print("Restored " + entry["path"])

if __name__ == "__main__":
    restore()
