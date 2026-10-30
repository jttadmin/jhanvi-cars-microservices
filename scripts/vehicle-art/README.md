# Vehicle artwork

The ride-type images in `frontend/public/vehicles/*-3d.webp` are original 3D renders made from
code. Every model (auto rickshaw, hatchback, sedan, SUV) is built from primitive shapes
in three.js and rendered with a studio lighting setup. No photos, brand models or logos are used.

## Re-render

```bash
cd scripts/vehicle-art
npm init -y && npm i three@0.170.0
pip install playwright pillow && python -m playwright install chromium
python render.py . ../../frontend/public/vehicles          # all four
python render.py . ../../frontend/public/vehicles auto     # just one
```

Colors, proportions and the camera angle are set in `scene.html` (`VEHICLES` and the
camera at the bottom). Output is `<name>.webp` at 480×320 — rename to `<name>-3d.webp` (or bump the suffix) so browsers fetch the new file with a transparent background.
