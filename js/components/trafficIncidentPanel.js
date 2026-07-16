// เหตุการณ์ & ความปลอดภัย: รายการเหตุการณ์ที่ระบบตรวจจับอัตโนมัติ
// (AI CCTV / Sensor จราจร / GPS geofence / LPR) เรียงตามความรุนแรง — คลิกซูมแผนที่
const TrafficIncidentPanel = {
  // ป้ายชื่อแหล่งตรวจจับ
  SOURCE_LABEL: {
    cctv: 'AI CCTV',
    lpr: 'LPR',
    sensor: 'Sensor จราจร',
    gps: 'GPS',
    ai: 'AI ศูนย์ควบคุม'
  },

  init(data) {
    this.data = data;
    // แสดงเฉพาะเหตุการณ์จราจร/อุบัติเหตุ — ตัดข้อมูลรถหาย/รถในบัญชีเฝ้าระวังออก
    this.events = data.trafficops.events.filter(e => e.type !== 'บัญชีเฝ้าระวัง');
    const open = this.events.filter(e => e.status !== 'resolved').length;
    document.getElementById('tie-sub').textContent =
      `เปิดอยู่ ${open} เหตุการณ์ · ตรวจจับอัตโนมัติจากกล้อง AI / sensor / GPS`;
    this.renderStats();
    this.renderList();
    this.renderTrend();
  },

  // สรุปจำนวนเหตุการณ์วันนี้ตามความรุนแรง
  renderStats() {
    const events = this.events;
    document.getElementById('tie-stats').innerHTML =
      Object.entries(CONFIG.SEVERITY).map(([key, meta]) => {
        const n = events.filter(e => e.severity === key).length;
        return `
          <div class="rounded-lg bg-surface2 border border-line/10 p-2 text-center">
            <div class="text-base font-semibold tabular-nums leading-tight"
                 style="color:${n > 0 ? (meta.textColor || meta.color) : 'var(--muted)'}">${n}</div>
            <div class="text-[9.5px] text-muted mt-0.5">${meta.label}</div>
          </div>`;
      }).join('');
  },

  // แนวโน้มจำนวนเหตุการณ์ย้อนหลัง 7 วัน (จำลอง — วันนี้คือแท่งสุดท้าย)
  renderTrend() {
    const C = CONFIG.COLORS;
    const days = ['อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.', 'วันนี้'];
    const counts = [2, 4, 3, 5, 2, 3, this.events.length];
    document.getElementById('tie-trend').innerHTML = `
      <div class="rounded-lg bg-surface2 border border-line/10 p-2.5">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-medium text-ink2">เหตุการณ์ย้อนหลัง 7 วัน</span>
          <span class="text-[9.5px] text-muted">รวม ${counts.reduce((a, b) => a + b, 0)} เหตุการณ์</span>
        </div>
        <div class="h-[42px]">${Spark.bars(counts, C.serious, { highlight: counts.length - 1 })}</div>
        <div class="flex justify-between text-[8.5px] text-muted mt-1 px-0.5">
          ${days.map(d => `<span>${d}</span>`).join('')}
        </div>
      </div>`;
  },

  renderList() {
    const order = { critical: 0, serious: 1, warning: 2, info: 3 };
    const events = [...this.events].sort((a, b) =>
      (a.status === 'resolved') - (b.status === 'resolved') ||
      order[a.severity] - order[b.severity]);

    document.getElementById('tie-list').innerHTML = events.map(ev => {
      const meta = CONFIG.SEVERITY[ev.severity];
      const resolved = ev.status === 'resolved';
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-3 cursor-pointer hover:border-line/25 transition-colors ${resolved ? 'opacity-60' : ''}"
             style="border-left-color:${meta.color}" data-lat="${ev.lat}" data-lng="${ev.lng}">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            ${Utils.badge(meta)}
            <span class="badge badge-info">${this.SOURCE_LABEL[ev.source] || ev.source}</span>
            <span class="text-[10px] text-muted">${Utils.esc(ev.type)} · ${Utils.timeHM(ev.time)} น.</span>
            ${resolved ? '<span class="badge badge-good">ปิดแล้ว</span>' : ''}
          </div>
          <div class="text-[11.5px] font-medium text-ink leading-snug">${Utils.esc(ev.title)}</div>
          <div class="text-[10.5px] text-ink2 leading-relaxed mt-0.5">${Utils.esc(ev.detail)}</div>
        </div>`;
    }).join('');

    document.querySelectorAll('#tie-list [data-lat]').forEach(el =>
      el.addEventListener('click', () => TrafficMap.focus(+el.dataset.lat, +el.dataset.lng)));
  }
};
