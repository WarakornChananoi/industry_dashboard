// แผงติดตามยานพาหนะ: รวมรถกองยาน (fleet) ที่ระบบติดตามอยู่จาก 2 แหล่ง
// GPS (รถลงทะเบียน/รถขนส่ง — ตำแหน่งต่อเนื่อง) และ LPR (ติดตามข้ามกล้อง AI CCTV)
// + สภาพการจราจรเส้นทางหลัก (LOS) — คลิกที่รถหรือเส้นทางเพื่อดูบนแผนที่
const VehicleTrackPanel = {
  init(data) {
    this.data = data;
    // เฉพาะรถกองยานที่ติดตามตามปกติ (ตัดรถบัญชีเฝ้าระวัง watch/alert ออก)
    this.fleet = data.vehicles.vehicles.filter(v => v.status === 'normal');

    const gps = this.fleet.filter(v => v.source === 'gps').length;
    const lpr = this.fleet.filter(v => v.source === 'lpr').length;
    document.getElementById('vt-sub').textContent =
      `ติดตามอยู่ ${this.fleet.length} คัน · GPS ${gps} · LPR ข้ามกล้อง ${lpr} · ` +
      `ความเร็วเฉลี่ยในเขต ${data.trafficops.summary.avgSpeedKmh} กม./ชม.`;

    this.renderStats();
    this.renderList();
    this.renderRoadConditions();
  },

  renderStats() {
    const C = CONFIG.COLORS;
    const gps = this.fleet.filter(v => v.source === 'gps').length;
    const lpr = this.fleet.filter(v => v.source === 'lpr').length;
    const segs = this.data.trafficsensors.roadSegments;
    const congested = segs.filter(s => s.los === 'heavy' || s.los === 'jam').length;

    const tiles = [
      { label: 'GPS Fleet', value: gps, sub: 'ตำแหน่งต่อเนื่อง', color: C.s1 },
      { label: 'LPR ข้ามกล้อง', value: lpr, sub: 'จากกล้อง AI', color: C.s5 },
      { label: 'เส้นทางติดขัด', value: congested, sub: `จาก ${segs.length} เส้นทาง`, color: C.crit }
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
    wrap.innerHTML = this.fleet.map(v => {
      const color = TrafficMap.vehicleColor(v);
      const srcTag = `<span class="badge badge-info">${v.source === 'gps' ? 'GPS' : 'LPR'}</span>`;
      const chain = (v.detections || []).map(d =>
        `<span class="rounded bg-page/60 border border-line/10 px-1.5 py-0.5">${d.camId} ${Utils.timeHM(d.time)}</span>`
      ).join('<span class="text-muted mx-0.5">→</span>');
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-3 cursor-pointer hover:border-line/25 transition-colors"
             style="border-left-color:${color}" data-vehicle="${v.id}">
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <span class="text-xs font-semibold text-ink tabular-nums">${Utils.esc(v.plate)}
              <span class="font-normal text-muted">${Utils.esc(v.province)}</span></span>
            ${srcTag}
          </div>
          <div class="text-[11px] text-ink2">${Utils.esc(v.type)} · ${v.speedKmh > 0
            ? `${v.speedKmh} กม./ชม. มุ่งหน้า${Utils.esc(v.heading)}` : 'จอดอยู่'}
            · ล่าสุด ${Utils.timeHM(v.lastSeen)} น.</div>
          ${v.destination !== '—' ? `
            <div class="text-[10px] text-muted mt-0.5">${Utils.esc(v.origin)} → ${Utils.esc(v.destination)}</div>` : ''}
          ${chain ? `
            <div class="flex flex-wrap items-center gap-y-1 mt-1.5 text-[9.5px] text-ink2 tabular-nums">
              <span class="text-muted mr-1">ตรวจจับ:</span>${chain}</div>` : ''}
          <div class="mt-1.5 text-[10.5px] leading-relaxed text-muted">${Utils.esc(v.note)}</div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-vehicle]').forEach(el =>
      el.addEventListener('click', () => TrafficMap.focusVehicle(el.dataset.vehicle)));
  },

  // สภาพการจราจรเส้นทางหลักตามระดับการให้บริการ (LOS) — คลิกเพื่อซูมแผนที่
  renderRoadConditions() {
    const wrap = document.getElementById('vt-roads');
    // เรียงจากติดขัดหนักสุดไปคล่องตัวสุด (ช้าก่อน)
    const segs = [...this.data.trafficsensors.roadSegments].sort((a, b) => a.speedKmh - b.speedKmh);

    wrap.innerHTML = segs.map(seg => {
      const meta = CONFIG.LOS[seg.los];
      const cong = Math.max(6, Math.min(100, Math.round((1 - seg.speedKmh / 50) * 100)));
      const delayTxt = seg.delayMin > 0
        ? `<span style="color:${meta.textColor || meta.color}">ล่าช้า +${seg.delayMin} นาที</span>`
        : '<span class="text-muted">ไม่มีความล่าช้า</span>';
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-2.5 cursor-pointer hover:border-line/25 transition-colors"
             style="border-left-color:${meta.color}" data-seg="${seg.id}">
          <div class="flex items-start justify-between gap-2 mb-1">
            <span class="text-[11.5px] font-medium text-ink leading-snug">${Utils.esc(seg.name)}</span>
            <span class="badge ${meta.badge} shrink-0">${meta.label}</span>
          </div>
          <div class="flex items-center gap-3 text-[10.5px] tabular-nums mb-1.5">
            <span class="text-ink2">${seg.speedKmh} กม./ชม.</span>
            ${delayTxt}
          </div>
          <div class="meter"><span style="width:${cong}%;background:${meta.color}"></span></div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-seg]').forEach(el =>
      el.addEventListener('click', () => TrafficMap.focusSegment(el.dataset.seg)));
  }
};
