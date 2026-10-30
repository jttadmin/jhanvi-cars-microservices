# Vehicle photos with a 3D studio look

`frontend/public/vehicles/*-photo3d.webp` are the original vehicle photos, processed to look 3D:

1. Cut out of the white background (`rembg`, isnet-general-use model)
2. Edges cleaned, slight contrast, color and sharpness boost
3. Grounded on the tyre line with a soft ground shadow and a faint floor reflection
4. Saved as 480×320 transparent WebP

The UI adds the motion: selected or hovered ride types turn and lift in 3D (CSS `perspective`).

## Re-run

```bash
pip install "rembg[cpu]" pillow
# 1) cut-outs: write <name>.png (transparent) for auto, economy, comfort, comfort-plus into ./cut
python -c "from rembg import remove, new_session; from PIL import Image; s=new_session('isnet-general-use'); \
[remove(Image.open(f'{n}.webp'), session=s, alpha_matting=True).save(f'cut/{n}.png') for n in ['auto','economy','comfort','comfort-plus']]"
# 2) 3D look
python make3d.py cut out   # -> out/<name>-3d.webp, rename to <name>-photo3d.webp
```
