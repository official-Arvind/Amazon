const fs = require('fs');
const files = ['checkout/index.html', 'login/index.html', 'orders/index.html', 'product/index.html'];
files.forEach(f => {
  if(fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/<a[^>]*class="logo-text"[^>]*>\s*ZONIX\s*(<\/a>|<svg)/g, match => {
      if(match.includes('<svg')) return match.replace('ZONIX', 'ZONIX<span class="logo-in" style="color:#f3a847">.in</span>\n              ');
      return match.replace('ZONIX', 'ZONIX<span class="logo-in">.in</span>');
    });
    fs.writeFileSync(f, content);
  }
});
