---
'@foldkit/ui': minor
---

Slider supports vertical layouts and opt-in edge alignment. `orientation` takes `Horizontal` or `Vertical` (matching the Tabs, RadioGroup, and Listbox unions) and switches `aria-orientation`, pointer mapping, and filled-track sizing, with `min` at the bottom for vertical sliders. `thumbAlignment` defaults to `Center`, which keeps the thumb's center on the value point and preserves existing slider geometry. Pass `Edge` with `thumbSize` set to your thumb's styled size to keep the thumb fully inside the track at the extremes. DOM attributes stay lowercase.
