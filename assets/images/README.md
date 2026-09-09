# assets/images

## Hintergrund des Hauptmenüs

Das Hauptmenü (`js/mainmenu.js` + Abschnitt 21 in `style.css`) lädt sein
Hintergrundbild **immer** von diesem festen Pfad:

```
assets/images/main-menu-bg.webp
```

* Format: **WebP** (oder AVIF, dann Datei ebenfalls `main-menu-bg.webp` nennen —
  der Browser erkennt das Format am Inhalt, nicht an der Endung).
* Empfohlene Größe: **2048 × 1152 px** (16:9), Qualität ~80, Ziel < 400 KB.
* Kein Text im Bild — alle Schrift kommt aus dem DOM.
* Der Bildausschnitt wird per `object-fit: cover` skaliert und über
  `object-position` pro Breakpoint so verschoben, dass Lukas (rechter
  Bildrand) auch im Hochformat sichtbar bleibt.

Fehlt die Datei, blendet `mainmenu.js` automatisch `main-menu-bg.svg`
(Low-Poly-Kulisse in derselben Palette) als Ersatz ein — das Menü sieht
also nie kaputt aus.
