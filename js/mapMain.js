// จุดเริ่มต้นของหน้าแผนที่ GIS: โหลด partials → โหลดข้อมูล JSON → เริ่มทุก component
// App.render() ถูกเรียกซ้ำได้เมื่อสลับธีม (รูปแบบเดียวกับ js/main.js ของหน้าแรก)
(async function bootstrap() {
  async function includePartials() {
    const holders = document.querySelectorAll('[data-include]');
    await Promise.all([...holders].map(async holder => {
      const url = holder.dataset.include;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`โหลด ${url} ไม่สำเร็จ (${res.status})`);
      const tpl = document.createElement('template');
      tpl.innerHTML = (await res.text()).trim();
      // คงคลาสจัดวางของ holder ไว้บน root ของ partial (เช่น xl:col-span-2)
      const root = tpl.content.firstElementChild;
      if (root && holder.className) root.classList.add(...holder.className.trim().split(/\s+/));
      holder.replaceWith(tpl.content);
    }));
  }

  function showError(err) {
    const box = document.getElementById('load-status');
    if (!box) return alert(err.message);
    box.classList.remove('hidden');
    box.innerHTML = `
      <b class="text-ink">โหลดข้อมูลไม่สำเร็จ:</b> ${Utils.esc(err.message)}<br>
      หน้านี้ต้องเปิดผ่าน local web server (ไม่ใช่เปิดไฟล์ตรงๆ) เช่นรันคำสั่ง
      <code class="bg-surface2 px-1.5 py-0.5 rounded">python -m http.server 8000</code>
      ในโฟลเดอร์โปรเจกต์ แล้วเปิด <code class="bg-surface2 px-1.5 py-0.5 rounded">http://localhost:8000/map.html</code>`;
    console.error(err);
  }

  try {
    await includePartials();
    ThemeToggle.init();

    const data = await DataService.loadAllGis();

    window.App = {
      data,
      render() {
        HeaderComponent.init(data);
        FloodAlertPanel.init(data);
        GisMap.init(data);
        WaterLevelPanel.init(data);
        WeatherPanel.init(data);
        RainPanel.init(data);
        LinkagePanel.init(data);

        document.getElementById('footer-updated').textContent =
          new Date(data.sensors.updatedAt).toLocaleString('th-TH');
      }
    };
    App.render();
  } catch (err) {
    showError(err);
  }
})();
