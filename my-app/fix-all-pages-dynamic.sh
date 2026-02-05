#!/bin/bash
# Add 'export const dynamic = force-dynamic' to all failing pages

echo "🔧 Adding dynamic export to all pages..."
echo ""

PAGES=(
  "app/page.tsx"
  "app/consignment-intake/page.tsx"
  "app/consignment/page.tsx"
  "app/customers/page.tsx"
  "app/export/page.tsx"
  "app/intake/page.tsx"
  "app/inventory/page.tsx"
  "app/labels/print/page.tsx"
  "app/lables/print/page.tsx"
  "app/migrate/page.tsx"
  "app/qr-scan/page.tsx"
  "app/square/page.tsx"
)

count=0

for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    # Check if it already has the export
    if grep -q "export const dynamic" "$page"; then
      echo "  ⏭️  Skipping $page (already has dynamic export)"
    else
      # Create backup
      cp "$page" "${page}.backup"
      
      # Add the export after the last import or after "use client"
      # This awk script adds the line after the last import statement
      awk '
        /^"use client";?$/ { print; use_client=1; next }
        /^import / { imports=1; print; next }
        imports && !/^import / && !added { 
          print ""; 
          print "export const dynamic = '\''force-dynamic'\'';"; 
          print ""; 
          added=1 
        }
        !imports && use_client && !added && !/^$/ { 
          print ""; 
          print "export const dynamic = '\''force-dynamic'\'';"; 
          print ""; 
          added=1 
        }
        { print }
      ' "$page" > "${page}.tmp" && mv "${page}.tmp" "$page"
      
      echo "  ✅ Fixed $page"
      count=$((count + 1))
    fi
  else
    echo "  ⚠️  Not found: $page"
  fi
done

echo ""
echo "✅ Fixed $count page(s)!"
echo ""
echo "Backups saved as: *.backup"
echo ""
echo "Now run: npm run build"
