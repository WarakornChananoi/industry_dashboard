// แสดงการทำงานเชื่อมโยงกันของระบบ: IoT → AI → แจ้งเตือน → SCADA
// แถบสถานะย่อ + แผนผังการไหล (pipeline) + ไทม์ไลน์เหตุการณ์ตอบสนองอัตโนมัติ (ย่อ)
const LinkagePanel = {
  // สี/ไอคอนของแหล่งข้อมูลแต่ละประเภท
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

  // แหล่งข้อมูล (source) แต่ละชนิดตกอยู่ในขั้นไหนของ pipeline
  stageOf(source) {
    return source === 'rain' ? 'iot' : source;
  },

  init(data) {
    const flow = data.floodzones.responseFlow;
    this.renderStatus(flow);
    this.renderPipeline(data, flow);
    this.renderTimeline(flow);
  },

  // แถบสถานะย่อ — แทนหัวข้อใหญ่เดิม บอกภาพรวมด้วยข้อความบรรทัดเดียว
  renderStatus(flow) {
    const active = flow.filter(e => e.status === 'active').length;
    const done = flow.filter(e => e.status === 'done').length;
    const latest = flow.filter(e => e.time).map(e => e.time).sort().pop();
    const st = active
      ? { badge: 'badge-warn', label: 'กำลังตอบสนอง', dot: 'var(--warn)' }
      : { badge: 'badge-good', label: 'ทำงานปกติ', dot: 'var(--good)' };

    document.getElementById('linkage-status').innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2 h-2 rounded-full live-dot shrink-0" style="background:${st.dot}"></span>
          <span class="text-[13px] font-semibold text-ink truncate">การเชื่อมโยงระบบอัตโนมัติ</span>
          <span class="badge ${st.badge} shrink-0">${st.label}</span>
        </div>
        ${latest ? `<span class="text-[10px] text-muted shrink-0 tabular-nums">${Utils.timeHM(latest)} น.</span>` : ''}
      </div>
      <p class="text-[10.5px] text-muted leading-snug mt-1">
        IoT → AI → แจ้งเตือน → SCADA ประสานงานอัตโนมัติ ·
        ตอบสนองสำเร็จ ${done} ขั้น${active ? ` · กำลังดำเนินการ ${active}` : ''}
      </p>`;
  },

  // แผนผัง 4 ขั้น (hero) — เน้นตัวเลขที่กำลังทำงานร่วมกัน + ไฮไลต์ขั้นที่กำลังดำเนินการ
  renderPipeline(data, flow) {
    const m = this.sourceMeta();
    const sensorsOn = data.sensors.sensors.length + data.rainfall.gauges.length;
    const zones = data.floodzones.zones.length;
    const alerts = data.floodzones.summary.factoriesAffected;
    const pumpsRunning = data.scada.pumpStations
      .flatMap(s => s.pumps).filter(p => p.status === 'running').length;

    const activeStages = new Set(
      flow.filter(e => e.status === 'active').map(e => this.stageOf(e.source)));

    const steps = [
      { key: 'iot', title: 'IoT Sensor', value: sensorsOn, unit: 'จุดตรวจวัด' },
      { key: 'ai', title: 'AI คาดการณ์', value: zones, unit: 'โซนเสี่ยง' },
      { key: 'alert', title: 'แจ้งเตือน', value: alerts, unit: 'โรงงาน' },
      { key: 'scada', title: 'SCADA', value: pumpsRunning, unit: 'ปั๊มกำลังเดิน' }
    ];

    const conn = `
      <span class="flow-conn">
        ${[0, 1, 2].map(() => `
          <svg class="flow-chev" width="7" height="9" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 6 6 6-6 6"/></svg>`).join('')}
      </span>`;

    const node = s => {
      const c = m[s.key].color;
      const active = activeStages.has(s.key);
      return `
        <div class="flex-1 flex flex-col items-center text-center gap-1 rounded-lg py-2 px-0.5"
             style="${active ? `background:${c}14;box-shadow:inset 0 0 0 1px ${c}55` : ''}">
          <div class="relative w-8 h-8 rounded-lg flex items-center justify-center"
               style="background:${c}1f;border:1px solid ${c}55">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[s.key].icon}</svg>
            ${active ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full live-dot"
                 style="background:var(--warn);border:1.5px solid var(--surface2)"></span>` : ''}
          </div>
          <div class="text-[10px] font-medium text-ink2 leading-tight">${s.title}</div>
          <div class="text-lg font-semibold tabular-nums leading-none" style="color:${c}">${s.value}</div>
          <div class="text-[9px] text-muted leading-tight">${s.unit}</div>
        </div>`;
    };

    document.getElementById('linkage-pipeline').innerHTML = `
      <div class="rounded-xl bg-surface2 border border-line/10 px-1.5 py-1 flex items-center">
        ${steps.map((s, i) => node(s) + (i < steps.length - 1 ? conn : '')).join('')}
      </div>`;
  },

  // ไทม์ไลน์ย่อ: สปอตไลต์เหตุการณ์ที่กำลังดำเนินการ + รายการที่เหลือแบบบรรทัดเดียว
  renderTimeline(flow) {
    const m = this.sourceMeta();
    const active = flow.filter(e => e.status === 'active');
    const rest = flow.filter(e => e.status !== 'active');

    // การ์ดสปอตไลต์ — เหตุการณ์ที่ระบบกำลังจัดการอยู่ตอนนี้ (จุดที่ต้องโฟกัส)
    const spotlight = active.map(ev => {
      const sm = m[ev.source];
      return `
        <div class="rounded-lg border p-2.5 mb-3"
             style="border-color:${sm.color}66;background:${sm.color}0f">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full live-dot shrink-0" style="background:${sm.color}"></span>
            <span class="text-[10px] font-semibold" style="color:${sm.color}">${Utils.esc(ev.sourceLabel)} · กำลังดำเนินการ</span>
            <span class="text-[10px] text-muted tabular-nums ml-auto">${ev.time ? Utils.timeHM(ev.time) + ' น.' : '—'}</span>
          </div>
          <div class="text-[11.5px] font-medium text-ink leading-snug">${Utils.esc(ev.title)}</div>
          <div class="text-[10.5px] text-ink2 leading-relaxed mt-0.5">${Utils.esc(ev.detail)}</div>
        </div>`;
    }).join('');

    // รายการที่เหลือ (สำเร็จ/รอเงื่อนไข) — บรรทัดเดียว เน้นสแกนง่าย ตัดรายละเอียดยาวออก
    const rows = rest.map(ev => {
      const sm = m[ev.source];
      const pending = ev.status === 'pending';
      const dot = pending ? 'var(--muted)' : sm.color;
      return `
        <div class="relative pb-2.5 last:pb-0">
          <span class="absolute -left-[17px] top-[3px] w-2 h-2 rounded-full"
                style="background:${dot};border:2px solid var(--surface)"></span>
          <div class="flex items-center gap-2">
            <span class="text-[10px] tabular-nums text-muted shrink-0">${ev.time ? Utils.timeHM(ev.time) : 'รอ'}</span>
            <span class="text-[10px] font-medium truncate" style="color:${dot}">${Utils.esc(ev.sourceLabel)}</span>
            ${pending ? '<span class="badge badge-info shrink-0 ml-auto">รอเงื่อนไข</span>' : ''}
          </div>
          <div class="text-[11px] text-ink2 leading-snug mt-0.5">${Utils.esc(ev.title)}</div>
        </div>`;
    }).join('');

    document.getElementById('linkage-timeline').innerHTML = `
      ${spotlight}
      <h3 class="text-[11px] font-medium text-muted mb-2">ลำดับการตอบสนองอัตโนมัติวันนี้</h3>
      <div class="relative pl-[17px]">
        <span class="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-grid"></span>
        ${rows}
      </div>`;
  }
};
