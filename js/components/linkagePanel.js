// แสดงการทำงานเชื่อมโยงกันของระบบ: IoT → AI → แจ้งเตือน → SCADA
// แผนผังขั้นตอน (pipeline) + ไทม์ไลน์เหตุการณ์ตอบสนองอัตโนมัติล่าสุด
const LinkagePanel = {
  // สี/ไอคอนของแหล่งข้อมูลแต่ละประเภทในไทม์ไลน์
  sourceMeta() {
    const C = CONFIG.COLORS;
    return {
      iot:   { color: C.s2, icon: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>' },
      rain:  { color: C.s1, icon: '<path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/><path d="M8 19v2M12 18v3M16 19v2"/>' },
      ai:    { color: C.s3, icon: '<path d="M12 2a4 4 0 0 1 4 4c1.9.6 3 2.1 3 4a4 4 0 0 1-1 2.6A4 4 0 0 1 16 20a4 4 0 0 1-4 2 4 4 0 0 1-4-2 4 4 0 0 1-2-7.4A4 4 0 0 1 5 10c0-1.9 1.1-3.4 3-4a4 4 0 0 1 4-4Z"/><path d="M12 6v12"/>' },
      alert: { color: C.serious, icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>' },
      scada: { color: C.s5, icon: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>' }
    };
  },

  STEP_STATUS: {
    done:    { label: 'สำเร็จ', badge: 'badge-good' },
    active:  { label: 'กำลังดำเนินการ', badge: 'badge-warn' },
    pending: { label: 'รอเงื่อนไข', badge: 'badge-info' }
  },

  init(data) {
    this.renderPipeline(data);
    this.renderTimeline(data.floodzones.responseFlow);
  },

  // แผนผัง 4 ขั้น: จำนวนอุปกรณ์/ระบบที่กำลังทำงานร่วมกันตอนนี้
  renderPipeline(data) {
    const C = CONFIG.COLORS;
    const m = this.sourceMeta();
    const sensorsOn = data.sensors.sensors.length + data.rainfall.gauges.length;
    const zones = data.floodzones.zones.length;
    const alerts = data.floodzones.summary.factoriesAffected;
    const pumpsRunning = data.scada.pumpStations
      .flatMap(s => s.pumps).filter(p => p.status === 'running').length;

    const steps = [
      { key: 'iot', title: 'IoT Sensor', value: sensorsOn, unit: 'จุดตรวจวัด', desc: 'ระดับน้ำ · คุณภาพน้ำ · ฝน' },
      { key: 'ai', title: 'AI คาดการณ์', value: zones, unit: 'โซนเสี่ยง', desc: 'FloodGuard + DEM + อุตุฯ' },
      { key: 'alert', title: 'แจ้งเตือน', value: alerts, unit: 'โรงงาน', desc: 'SMS / LINE อัตโนมัติ' },
      { key: 'scada', title: 'SCADA ตอบสนอง', value: pumpsRunning, unit: 'ปั๊มกำลังเดิน', desc: 'ปั๊มระบาย + ประตูน้ำ' }
    ];

    document.getElementById('linkage-pipeline').innerHTML = `
      <div class="grid grid-cols-4 gap-1.5">
        ${steps.map((s, i) => `
          <div class="relative rounded-lg bg-surface2 border border-line/10 p-2 text-center">
            <div class="w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1"
                 style="background:${m[s.key].color}1f;border:1px solid ${m[s.key].color}55">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${m[s.key].color}"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[s.key].icon}</svg>
            </div>
            <div class="text-[10px] font-medium text-ink leading-tight">${s.title}</div>
            <div class="text-base font-semibold tabular-nums" style="color:${m[s.key].color}">${s.value}</div>
            <div class="text-[9px] text-muted leading-tight">${s.unit}</div>
            <div class="text-[9px] text-muted leading-tight mt-0.5 hidden sm:block">${s.desc}</div>
            ${i < steps.length - 1 ? `
              <span class="absolute top-1/2 -right-[7px] -translate-y-1/2 z-10 text-muted">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>
              </span>` : ''}
          </div>`).join('')}
      </div>`;
  },

  // ไทม์ไลน์การตอบสนองอัตโนมัติ (จากข้อมูล responseFlow)
  renderTimeline(flow) {
    const m = this.sourceMeta();
    document.getElementById('linkage-timeline').innerHTML = `
      <h3 class="text-xs font-medium text-ink2 mb-2">ลำดับเหตุการณ์ตอบสนองอัตโนมัติวันนี้</h3>
      <div class="relative pl-5">
        <span class="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-grid"></span>
        ${flow.map(ev => {
          const sm = m[ev.source];
          const st = this.STEP_STATUS[ev.status];
          return `
            <div class="relative pb-3.5 last:pb-0">
              <span class="absolute -left-5 top-1 w-[15px] h-[15px] rounded-full flex items-center justify-center
                ${ev.status === 'active' ? 'marker-critical' : ''}"
                style="background:${sm.color};border:2px solid var(--surface)">
              </span>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="text-[10px] font-medium" style="color:${sm.color}">${ev.sourceLabel}</span>
                <span class="text-[10px] text-muted tabular-nums">${ev.time ? Utils.timeHM(ev.time) + ' น.' : '—'}</span>
                <span class="badge ${st.badge}">${st.label}</span>
              </div>
              <div class="text-[11.5px] font-medium text-ink leading-snug mt-0.5">${Utils.esc(ev.title)}</div>
              <div class="text-[10.5px] text-ink2 leading-relaxed mt-0.5">${Utils.esc(ev.detail)}</div>
            </div>`;
        }).join('')}
      </div>`;
  }
};
