// ปุ่มสลับธีม dark / light — จำค่าที่เลือกไว้ใน localStorage
const ThemeToggle = {
  init() {
    const btn = document.getElementById('theme-toggle');
    this.updateIcon(document.documentElement.dataset.theme);
    btn.onclick = () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      this.apply(next);
    };
  },

  apply(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
    applyTheme(theme);            // สลับ palette ของ JS/Chart.js
    this.updateIcon(theme);
    if (window.App) App.render(); // วาด component ทั้งหมดใหม่ด้วยสีของธีมใหม่
  },

  updateIcon(theme) {
    // แสดงไอคอนของธีมที่ "จะสลับไป": ธีมมืดโชว์พระอาทิตย์ ธีมสว่างโชว์พระจันทร์
    document.getElementById('theme-icon-sun').classList.toggle('hidden', theme === 'light');
    document.getElementById('theme-icon-moon').classList.toggle('hidden', theme !== 'light');
  }
};
