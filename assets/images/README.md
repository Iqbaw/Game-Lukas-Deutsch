# assets/images

## Hintergrund des Hauptmenüs

`main-menu-bg.webp` ist das **Original** (5504 × 3040). Ausgeliefert wird es
nicht — 16,7 Megapixel kosten beim Dekodieren spürbar Zeit. Das Menü lädt
stattdessen die skalierten Varianten:

| Datei | Größe | Einsatz |
|---|---|---|
| `main-menu-bg-1280.webp` | 1280 × 707 | Handy / kleines Tablet |
| `main-menu-bg-1920.webp` | 1920 × 1060 | Desktop (auch `src`-Fallback) |
| `main-menu-bg-2560.webp` | 2560 × 1414 | große und Retina-Displays |

Die Auswahl trifft der Browser über `srcset`/`sizes` in `js/mainmenu.js`.
Zusätzlich steckt dort ein **LQIP**: eine 32 px breite Miniatur derselben
Kulisse, inline als `data:`-URI. Sie ist im allerersten Frame sichtbar,
danach tauscht das scharfe WebP unmerklich darüber — deshalb wirkt der
Hintergrund ohne Verzögerung „schon da“.

### Wenn das Bild ausgetauscht wird

Neues Original als `main-menu-bg.webp` ablegen und die Varianten neu
erzeugen (Pillow):

```python
from PIL import Image, ImageFilter
import base64, io
src = Image.open('assets/images/main-menu-bg.webp').convert('RGB')
W, H = src.size
for w in (1280, 1920, 2560):
    src.resize((w, round(w * H / W)), Image.LANCZOS) \
       .save(f'assets/images/main-menu-bg-{w}.webp', 'WEBP', quality=82, method=6)

# LQIP für BG_LQIP in js/mainmenu.js
tiny = src.resize((32, round(32 * H / W)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
buf = io.BytesIO(); tiny.save(buf, 'WEBP', quality=62, method=6)
print('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
```

Danach ggf. `object-position` in `style.css` (Abschnitt 21/21b) anpassen,
damit Lukas auch im Hochformat im Bild bleibt.

Fehlen die Dateien, blendet `mainmenu.js` automatisch `main-menu-bg.svg`
(Low-Poly-Kulisse in derselben Palette) ein — das Menü sieht also nie
kaputt aus.
