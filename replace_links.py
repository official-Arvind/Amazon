import os

def update_links(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Fix for navbar Links:
                # `href="../profile/"` or `href="profile/"`
                # Only if the next few lines contain "Returns" and "& Orders"
                # Actually, an easy way is to replace `<a href="../profile/" class="nav-link-custom">`
                # with `<a href="../orders/" class="nav-link-custom">`
                # BUT ONLY when it's the Returns & Orders link.
                
                # I'll manually split and replace
                
                new_content = ""
                lines = content.split('\n')
                for i in range(len(lines)):
                    line = lines[i]
                    if 'href="profile/"' in line or 'href="../profile/"' in line:
                        # Check if next 3 lines contain "Returns"
                        is_returns = False
                        for j in range(1, 4):
                            if i + j < len(lines) and 'Returns' in lines[i+j]:
                                is_returns = True
                                break
                        if is_returns:
                            line = line.replace('href="profile/"', 'href="orders/"')
                            line = line.replace('href="../profile/"', 'href="../orders/"')
                    
                    new_content += line + '\n'
                
                # Remove last newline
                new_content = new_content[:-1] if new_content.endswith('\n') else new_content

                if new_content != content:
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)

update_links(r"d:\Desktop\Website\Amazon\frontend")
