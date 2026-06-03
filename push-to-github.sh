#!/usr/bin/env bash
# Pushes this repo to https://github.com/omarmax19962/Go-doc-sys
# Run once after creating the empty GitHub repo on github.com.
set -e

cd "$(dirname "$0")"

if ! git remote | grep -q "^origin$"; then
  git remote add origin https://github.com/omarmax19962/Go-doc-sys.git
fi

git branch -M main
git push -u origin main
echo ""
echo "✓ Pushed. Next steps:"
echo "  1. https://vercel.com/new — import Go-doc-sys"
echo "  2. Add env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
echo "  3. Deploy"
