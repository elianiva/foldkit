---
'foldkit': minor
---

Add re-render outline tracking in the runtime and DevTools overlay. Boundaries that patch on each frame register outline metadata the overlay can draw with an offscreen canvas worker. Submodel and lazy views emit finer-grained outlines when child input changes.
