#!/usr/bin/env bash
set -euo pipefail

echo "== TradingView Assets Setup (Next.js) =="

if [[ ! -f "package.json" ]]; then
  echo "❌ package.json not found. Bitte im Projekt-Root ausführen."
  exit 1
fi

mkdir -p public
echo "✅ public/ ist vorhanden."

SRC="${1:-}"

# Falls du den TV-Ordner kennst: als 1. Argument übergeben
# z.B.: bash setup-tradingview-assets.sh ./tradingview
if [[ -n "$SRC" ]]; then
  if [[ ! -d "$SRC" ]]; then
    echo "❌ SRC Pfad existiert nicht: $SRC"
    exit 1
  fi

  if [[ -d "$SRC/charting_library" ]]; then
    echo "➡️  Kopiere charting_library -> public/charting_library"
    rm -rf public/charting_library
    cp -R "$SRC/charting_library" public/charting_library
  else
    echo "⚠️  Kein $SRC/charting_library gefunden."
  fi

  if [[ -d "$SRC/datafeeds" ]]; then
    echo "➡️  Kopiere datafeeds -> public/datafeeds"
    rm -rf public/datafeeds
    cp -R "$SRC/datafeeds" public/datafeeds
  else
    echo "⚠️  Kein $SRC/datafeeds gefunden."
  fi
else
  echo "🔎 Kein SRC angegeben. Suche automatisch im Projekt…"

  CHARTING_DIR="$(find . -maxdepth 10 -type d -name "charting_library" 2>/dev/null | head -n 1 || true)"
  UDF_DIST_DIR="$(find . -maxdepth 12 -type d -path "*datafeeds/udf/dist" 2>/dev/null | head -n 1 || true)"

  if [[ -n "$CHARTING_DIR" ]]; then
    echo "➡️  Gefunden: ${CHARTING_DIR#./}"
    rm -rf public/charting_library
    cp -R "$CHARTING_DIR" public/charting_library
  else
    echo "⚠️  charting_library/ nicht gefunden."
  fi

  if [[ -n "$UDF_DIST_DIR" ]]; then
    DATAFEEDS_ROOT="${UDF_DIST_DIR%/udf/dist}"
    echo "➡️  Gefunden datafeeds root: ${DATAFEEDS_ROOT#./}"
    rm -rf public/datafeeds
    cp -R "$DATAFEEDS_ROOT" public/datafeeds
  else
    echo "⚠️  datafeeds/udf/dist nicht gefunden."
  fi
fi

echo
echo "== Verifikation =="
ls -la public || true
echo

if [[ -d "public/charting_library" ]]; then
  echo "✅ public/charting_library existiert."
  ls -la public/charting_library | head -n 10
else
  echo "❌ public/charting_library fehlt."
fi

echo

if [[ -d "public/datafeeds/udf/dist" ]]; then
  echo "✅ public/datafeeds/udf/dist existiert."
  ls -la public/datafeeds/udf/dist | head -n 20
else
  echo "❌ public/datafeeds/udf/dist fehlt."
fi

echo
echo "== Browser Test URLs =="
echo "http://localhost:3000/charting_library/charting_library.standalone.js"
echo "http://localhost:3000/datafeeds/udf/dist/bundle.js"
echo
echo "✅ Fertig."
