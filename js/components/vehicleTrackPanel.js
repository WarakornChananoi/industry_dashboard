// แผงติดตามยานพาหนะ: รวมรถที่ระบบติดตามอยู่จาก 2 แหล่ง
// GPS (รถลงทะเบียน/รถขนส่ง — ตำแหน่งต่อเนื่อง) และ LPR (ติดตามข้ามกล้อง AI CCTV)
// คลิกที่รถเพื่อดูเส้นทาง tracking บนแผนที่
const VehicleTrackPanel = {
  init(data) {
    this.data = data;
    const s = data.vehicles.summary;
    document.getElementById('vt-sub').textContent =
      `ติดตามอยู่ ${s.trackedNow} คัน · GPS ${s.gpsFleet} · LPR ข้ามกล้อง ${s.lprTracked} · เฝ้าระวัง ${s.watchlistActive}`;
    this.renderStats();
    this.renderList();
  },

  renderStats() {
    const C = CONFIG.COLORS;
    const s = this.data.vehicles.summary;
    const tiles = [
      { label: 'GPS Fleet', value: s.gpsFleet, sub: 'ตำแหน่งต่อเนื่อง', color: C.s1 },
      { label: 'LPR ข้ามกล้อง', value: s.lprTracked, sub: 'จากกล้อง AI', color: C.s5 },
      { label: 'เฝ้าระวัง', value: s.watchlistActive, sub: 'watch / alert', color: C.crit }
    ];
    document.getElementById('vt-stats').innerHTML = tiles.map(t => `
      <div class="rounded-lg bg-surface2 border border-line/10 p-2 text-center">
        <div class="text-lg font-semibold tabular-nums" style="color:${t.color}">${t.value}</div>
        <div class="text-[10px] font-medium text-ink leading-tight">${t.label}</div>
        <div class="text-[9px] text-muted">${t.sub}</div>
      </div>`).join('');
  },

  renderList() {
    const wrap = document.getElementById('vt-list');
    const order = { alert: 0, watch: 1, normal: 2 };
    const vehicles = [...this.data.vehicles.vehicles]
      .sort((a, b) => order[a.status] - order[b.status]);

    wrap.innerHTML = vehicles.map(v => {
      const st = CONFIG.VEHICLE_STATUS[v.status];
      const color = TrafficMap.vehicleColor(v);
      const srcTag = v.source === 'gps'
        ? `<span class="badge badge-info">GPS</span>`
        : `<span class="badge badge-info">LPR</span>`;
      const chain = (v.detections || []).map(d =>
        `<span class="rounded bg-page/60 border border-line/10 px-1.5 py-0.5">${d.camId} ${Utils.timeHM(d.time)}</span>`
      ).join('<span class="text-muted mx-0.5">→</span>');
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-3 cursor-pointer hover:border-line/25 transition-colors"
             style="border-left-color:${color}" data-vehicle="${v.id}">
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <span class="text-xs font-semibold text-ink tabular-nums">${Utils.esc(v.plate)}
              <span class="font-normal text-muted">${Utils.esc(v.province)}</span></span>
            <span class="flex items-center gap-1">${srcTag}${Utils.badge(st)}</span>
          </div>
          <div class="text-[11px] text-ink2">${Utils.esc(v.type)} · ${v.speedKmh > 0
            ? `${v.speedKmh} กม./ชม. มุ่งหน้า${Utils.esc(v.heading)}` : 'จอดอยู่'}
            · ล่าสุด ${Utils.timeHM(v.lastSeen)} น.</div>
          ${v.destination !== '—' ? `
            <div class="text-[10px] text-muted mt-0.5">${Utils.esc(v.origin)} → ${Utils.esc(v.destination)}</div>` : ''}
          ${chain ? `
            <div class="flex flex-wrap items-center gap-y-1 mt-1.5 text-[9.5px] text-ink2 tabular-nums">
              <span class="text-muted mr-1">ตรวจจับ:</span>${chain}</div>` : ''}
          <div class="mt-1.5 text-[10.5px] leading-relaxed ${v.status === 'normal' ? 'text-muted' : ''}"
               ${v.status !== 'normal' ? `style="color:${st.textColor || st.color}"` : ''}>
            ${v.status !== 'normal' ? '⚠ ' : ''}${Utils.esc(v.note)}
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-vehicle]').forEach(el =>
      el.addEventListener('click', () => TrafficMap.focusVehicle(el.dataset.vehicle)));
  }
};
