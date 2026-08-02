# botok dialect pack

Grammar check can use [botok](https://github.com/OpenPecha/botok) for Tibetan word
segmentation (case-particle spans + RAG particle queries). Regex rules remain the
fallback when this pack is missing (`GRAMMAR_USE_BOTOK=true` still fails open).

## Install the `general` pack

Option A — let botok download once into its default location:

```bash
cd backend
../.venv/bin/python -c "
from botok import WordTokenizer
from botok.config import Config
from pathlib import Path
Config(dialect_name='general', base_path=Path.home()/'Documents'/'pybo'/'dialect_packs')
WordTokenizer()
print('ok')
"
```

Option B — place the pack here:

```
data/botok/general/
  dictionary/
  adjustments/
```

Set `BOTOK_BASE_PATH=data/botok` (default) and `BOTOK_DIALECT_NAME=general`.

Disable with `GRAMMAR_USE_BOTOK=false`.
