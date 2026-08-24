# Deity portraits

Drop a PNG (or jpg/webp) here and name it on the god:

```ts
xima: { id: 'xima', /* … */ art: 'xima.png' },
```

`src/ui/lib/deityArt.ts` maps the filename to its built URL, exactly the way
`enemyArt.ts` does for monsters. A god with no `art` falls back to its emoji,
so portraits can arrive one at a time.

Roughly square images work best — the grid crops to a square tile and the
opened panel shows the same picture larger.
