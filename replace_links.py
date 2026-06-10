import os
import re

def update_links(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Replace "Returns & Orders" href in navbar
                # Desktop
                content = re.sub(
                    r'<a href="(?:\.\./)*profile/"([^>]*?)(class="nav-link-custom[^"]*?"[^>]*?)>\s*<span class="nav-small">Returns</span>\s*<span class="nav-bold">& Orders</span>',
                    lambda m: f'<a href="{m.group(0).split("profile/")[0]}orders/"{m.group(1)}{m.group(2)}>\n                    <span class="nav-small">Returns</span>\n                    <span class="nav-bold">& Orders</span>',
                    content,
                    flags=re.DOTALL
                )

                # Fix for exact matching if regex above failed
                # Simply replace profile/ with orders/ when followed by "Returns"
                pattern = r'<a href="([^"]*?)profile/"(.*?)<span class="nav-small">Returns</span>'
                content = re.sub(
                    pattern,
                    r'<a href="\1orders/"\2<span class="nav-small">Returns</span>',
                    content,
                    flags=re.DOTALL
                )

                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)

update_links(r"d:\Desktop\Website\Amazon\frontend")
