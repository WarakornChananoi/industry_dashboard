// ส่วนหัว: นาฬิกาเรียลไทม์ + ตัวนับการแจ้งเตือนที่ยังไม่ปิด
const HeaderComponent = {
  init(data) {
    this.startClock();
    this.markActiveNav();

    // นับการแจ้งเตือนที่ยังไม่ปิด — หน้าน้ำใช้ anomalies / หน้า Smart Traffic ใช้ trafficops
    const events = data.anomalies?.events ?? data.trafficops?.events ?? [];
    const open = events.filter(e => e.status !== 'resolved').length;
    const wrap = document.getElementById('header-alert');
    if (open > 0) {
      document.getElementById('header-alert-count').textContent = open;
      wrap.classList.remove('hidden');
      wrap.classList.add('flex');
    }
  },

  // ไฮไลต์ลิงก์ของหน้าปัจจุบันบนแถบสลับหน้า
  markActiveNav() {
    const page = /traffic\.html$/i.test(location.pathname) ? 'traffic'
      : /map\.html$/i.test(location.pathname) ? 'map' : 'index';
    document.querySelectorAll('#main-nav .nav-link').forEach(a =>
      a.classList.toggle('active', a.dataset.page === page));

    // ปุ่มโหมดสไลด์นำเสนอ — ชี้ไปสไลด์ของหน้าปัจจุบัน
    const present = document.getElementById('present-link');
    if (present) present.href = {
      index: 'slide-water.html', map: 'slide-flood.html', traffic: 'slide-traffic.html'
    }[page];
  },

  _clockStarted: false,

  startClock() {
    if (this._clockStarted) return; // กัน interval ซ้อนเมื่อ render ซ้ำ (สลับธีม)
    this._clockStarted = true;
    const clock = document.getElementById('header-clock');
    const date = document.getElementById('header-date');
    const tick = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
      date.textContent = now.toLocaleDateString('th-TH', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    };
    tick();
    setInterval(tick, 1000);
  }
};
