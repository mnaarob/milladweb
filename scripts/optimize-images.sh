#!/usr/bin/env bash
# Re-encode WebP/JPEG images at smaller dimensions and modern compression.
# Requires: cwebp, dwebp (brew install webp).
#
# Usage:
#   scripts/optimize-images.sh
#
# Edit the SPEC list below to add files or change targets.
# Format: "SRC_PATH|MAX_WIDTH|QUALITY[|OUT_SUFFIX]"
# - MAX_WIDTH: longest edge in px, image is only downsized (never enlarged).
# - QUALITY: 1..100, cwebp -q.
# - OUT_SUFFIX (optional): when present, write SRC_BASE+SUFFIX.webp next to SRC
#   instead of overwriting SRC. Used to generate responsive variants
#   (e.g. heroimage2-640.webp).

set -euo pipefail

if ! command -v cwebp >/dev/null 2>&1 || ! command -v dwebp >/dev/null 2>&1; then
    echo "ERROR: cwebp/dwebp not found. Install with: brew install webp" >&2
    exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Hero (LCP) – full-bleed banner. 1600px is plenty for retina at < ~1200px wide stages.
# Category tiles – display ~300px square. 600px covers retina @2x.
# Banner promos – display ~570px wide. 1100px covers retina.
# Blog thumbs – display ~360px wide. 720px covers retina.
# Featured product cards – display ~270px square. 600px covers retina @2x.
SPECS=(
    # Responsive hero variants. The full-size LCP image is the last entry so
    # the original filename is what ships at desktop widths.
    "images/meat/heroimage2.webp|640|68|-640"
    "images/meat/heroimage2.webp|1024|70|-1024"
    "images/meat/heroimage2.webp|1600|72"
    "images/meat/FreshMeat.webp|640|72"
    "images/meat/SeaFood.webp|640|72"
    "images/meat/Poultry.webp|640|72"
    "images/meat/LambLeg.webp|640|72"
    "images/fruits/freshProduce.webp|640|72"
    "img/banner/Banner1.webp|1100|74"
    "img/banner/Banner2.webp|1100|74"
    "img/blog/blog01.jpg|720|75"
    "img/blog/blog002.jpg|720|75"
    "img/blog/blog03.jpg|720|75"
    # Featured products (homepage Featured grid). All re-encoded at 600px / q=72.
    "images/meat/BonelessBeef.webp|600|72"
    "images/meat/BeefBoneIn.webp|600|72"
    "images/meat/Oxtail.webp|600|72"
    "images/meat/BeefLiver.webp|600|72"
    "images/meat/BeefKidney.webp|600|72"
    "images/meat/BeefTongue.webp|600|72"
    "images/meat/WholeChicken.webp|600|72"
    "images/meat/ChickenDrumstick.webp|600|72"
    "images/meat/ChickenLegThigh.webp|600|72"
    "images/meat/ChickenBreast.webp|600|72"
    "images/meat/FreshLamb.webp|600|72"
    "images/meat/FrozenLambLeg.webp|600|72"
    "images/meat/FrozenGoatMeat.webp|600|72"
    "images/meat/FrozenTilapia.webp|600|72"
    "images/meat/FrozenMackerel.webp|600|72"
    "images/meat/TilapiaFish.webp|600|72"
    "images/meat/Mackerel.webp|600|72"
    "images/bakery/AfghanBread.webp|600|72"
)

total_before=0
total_after=0

for spec in "${SPECS[@]}"; do
    IFS='|' read -r src max_w quality out_suffix <<<"$spec"
    if [ ! -f "$src" ]; then
        echo "SKIP (missing): $src"
        continue
    fi

    before=$(stat -f%z "$src")
    ext="${src##*.}"
    base="$(basename "$src" ."$ext")"
    # Detect true type (some files are misnamed, e.g. JPEG with .webp ext).
    kind=$(file -b "$src" | awk '{print $1}')

    decoded="$src"
    case "$kind" in
        RIFF) # real WebP
            decoded="$TMP_DIR/${base}.png"
            dwebp -quiet "$src" -o "$decoded"
            ;;
        JPEG|PNG|TIFF)
            decoded="$src"
            ;;
        *)
            echo "SKIP (unknown kind=$kind): $src"
            continue
            ;;
    esac

    out="$TMP_DIR/${base}.opt.webp"
    cwebp -quiet -mt -q "$quality" -resize "$max_w" 0 -m 6 -metadata none "$decoded" -o "$out"

    after=$(stat -f%z "$out")

    if [ -n "$out_suffix" ]; then
        # Variant output: place SRC_BASE+SUFFIX.webp next to the source.
        # e.g. images/meat/heroimage2.webp + "-640" -> images/meat/heroimage2-640.webp
        src_dir="$(dirname "$src")"
        src_stem="$(basename "$src" ."$ext")"
        webp_dest="$src_dir/${src_stem}${out_suffix}.webp"
        mv "$out" "$webp_dest"
        after=$(stat -f%z "$webp_dest")
        printf "%-44s %8d bytes  (variant %s, %dpx)\n" "$webp_dest" "$after" "$out_suffix" "$max_w"
        total_after=$((total_after + after))
        continue
    fi

    # In-place replacement of the source for plain entries.
    if [ "$ext" = "webp" ]; then
        mv "$out" "$src"
    else
        webp_dest="${src%.*}.webp"
        mv "$out" "$webp_dest"
        after=$(stat -f%z "$webp_dest")
    fi

    pct=$(( 100 - (after * 100 / before) ))
    printf "%-44s %8d -> %8d bytes  (%d%% smaller)\n" "$src" "$before" "$after" "$pct"
    total_before=$((total_before + before))
    total_after=$((total_after + after))
done

echo "------------------------------------------------------------"
saved=$((total_before - total_after))
printf "TOTAL: %d -> %d bytes  (%d bytes saved)\n" "$total_before" "$total_after" "$saved"
