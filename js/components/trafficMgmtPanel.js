// ศูนย์บริหารจัดการจราจร: เป้าหมายคือ "ลดการจราจรติดขัด เพิ่มความปลอดภัย"
// แถบสถานะย่อ + แผนผังการทำงานร่วมกัน (hero) + คำแนะนำปรับสัญญาณไฟ AI + ไทม์ไลน์ (ย่อ)
const TrafficMgmtPanel = {
  // สี/ไอคอนของแหล่งข้อมูลแต่ละประเภท
  sourceMeta() {
    const C = CONFIG.COLORS;
    return {
      cctv:   { color: C.s5, icon: '<path d="M2 8.5 15 5l1 3.8-13 3.5Z"/><path d="M8.6 11.2 8 14h8l-.7-4.6"/><path d="M12 14v4M8 21h8"/>' },
      sensor: { color: C.s2, icon: '<path d="M12 20v-6M7.8 8.8a6 6 0 0 1 8.4 0M4.9 5.9a10 10 0 0 1 14.2 0"/>' },
      gps:    { color: C.s1, icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/>' },
      ai:     { color: C.s3, icon: '<path d="M12 2a4 4 0 0 1 4 4c1.9.6 3 2.1 3 4a4 4 0 0 1-1 2.6A4 4 0 0 1 16 20a4 4 0 0 1-4 2 4 4 0 0 1-4-2 4 4 0 0 1-2-7.4A4 4 0 0 1 5 10c0-1.9 1.1-3.4 3-4a4 4 0 0 1 4-4Z"/><path d="M12 6v12"/>' },
      alert:  { color: C.serious, icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>' },
      signal: { color: C.good, icon: '<rect x="8" y="2" width="8" height="20" rx="2"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>' }
    };
  },

  STEP_STATUS: {
    done:    { label: 'สำเร็จ', badge: 'badge-good' },
    active:  { label: 'กำลังดำเนินการ', badge: 'badge-warn' },
    pending: { label: 'รอเงื่อนไข', badge: 'badge-info' }
  },

  // แหล่งข้อมูล (source) ในไทม์ไลน์ตกอยู่ในขั้นไหนของ pipeline
  stageOf(source) {
    if (source === 'sensor' || source === 'gps') return 'cctv';   // ขั้น "ตรวจจับ"
    if (source === 'signal' || source === 'alert') return 'signal'; // ขั้น "สั่งการ/แจ้งเตือน"
    return source; // cctv, ai
  },

  init(data) {
    this.data = data;
    // นับเฉพาะเหตุการณ์จราจร/อุบัติเหตุ (ตัดบัญชีเฝ้าระวังออก ให้ตรงกับแผงเหตุการณ์)
    this.events = data.trafficops.events.filter(e => e.type !== 'บัญชีเฝ้าระวัง');
    this.renderStatus();
    this.renderPipeline();
    this.renderSignals();
    this.renderTimeline();
  },

  // แถบสถานะย่อ — แทนหัวข้อใหญ่เดิม สรุปภาพรวมบรรทัดเดียว
  renderStatus() {
    const flow = this.data.trafficops.responseFlow;
    const active = flow.filter(e => e.status === 'active').length;
    const done = flow.filter(e => e.status === 'done').length;
    const latest = flow.filter(e => e.time).map(e => e.time).sort().pop();
    const st = active
      ? { badge: 'badge-warn', label: 'กำลังตอบสนอง', dot: 'var(--warn)' }
      : { badge: 'badge-good', label: 'ทำงานปกติ', dot: 'var(--good)' };

    document.getElementById('tm-status').innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2 h-2 rounded-full live-dot shrink-0" style="background:${st.dot}"></span>
          <span class="text-[13px] font-semibold text-ink truncate">ศูนย์บริหารจัดการจราจร</span>
          <span class="badge ${st.badge} shrink-0">${st.label}</span>
        </div>
        ${latest ? `<span class="text-[10px] text-muted shrink-0 tabular-nums">${Utils.timeHM(latest)} น.</span>` : ''}
      </div>
      <p class="text-[10.5px] text-muted leading-snug mt-1">
        ตรวจจับ → AI วิเคราะห์ → สั่งการ/แจ้งเตือน ทำงานอัตโนมัติ ·
        ตอบสนองสำเร็จ ${done} ขั้น${active ? ` · กำลังดำเนินการ ${active}` : ''}
      </p>`;
  },

  // แผนผัง 4 ขั้น (hero) — เน้นตัวเลข + ไฮไลต์ขั้นที่กำลังดำเนินการ
  renderPipeline() {
    const d = this.data;
    const m = this.sourceMeta();
    const s = d.trafficops.summary;
    const detect = s.camerasOnline + s.sensorsOnline;
    const analyzed = this.events.length;
    const actions = d.trafficops.signalPlans.filter(p => p.status !== 'pending').length
      + this.events.filter(e => e.status === 'active').length;
    const improvePlans = d.trafficops.signalPlans.filter(p => p.expectedImprovementPct > 0);
    const avgImprove = Math.round(
      improvePlans.reduce((sum, p) => sum + p.expectedImprovementPct, 0) / improvePlans.length);

    const activeStages = new Set(
      d.trafficops.responseFlow.filter(e => e.status === 'active').map(e => this.stageOf(e.source)));

    const steps = [
      { key: 'cctv', title: 'ตรวจจับ', value: detect, unit: 'กล้อง + sensor' },
      { key: 'ai', title: 'AI วิเคราะห์', value: analyzed, unit: 'เหตุการณ์วันนี้' },
      { key: 'signal', title: 'สั่งการ / แจ้งเตือน', value: actions, unit: 'รายการ' },
      { key: 'alert', title: 'ผลลัพธ์', value: `-${avgImprove}%`, unit: 'เวลารอเฉลี่ย' }
    ];

    const conn = `
      <span class="flow-conn">
        ${[0, 1, 2].map(() => `
          <svg class="flow-chev" width="7" height="9" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 6 6 6-6 6"/></svg>`).join('')}
      </span>`;

    const node = st => {
      const c = m[st.key].color;
      const active = activeStages.has(st.key);
      return `
        <div class="flex-1 flex flex-col items-center text-center gap-1 rounded-lg py-2 px-0.5"
             style="${active ? `background:${c}14;box-shadow:inset 0 0 0 1px ${c}55` : ''}">
          <div class="relative w-8 h-8 rounded-lg flex items-center justify-center"
               style="background:${c}1f;border:1px solid ${c}55">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[st.key].icon}</svg>
            ${active ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full live-dot"
                 style="background:var(--warn);border:1.5px solid var(--surface2)"></span>` : ''}
          </div>
          <div class="text-[10px] font-medium text-ink2 leading-tight">${st.title}</div>
          <div class="text-lg font-semibold tabular-nums leading-none" style="color:${c}">${st.value}</div>
          <div class="text-[9px] text-muted leading-tight">${st.unit}</div>
        </div>`;
    };

    document.getElementById('tm-pipeline').innerHTML = `
      <div class="rounded-xl bg-surface2 border border-line/10 px-1.5 py-1 flex items-center">
        ${steps.map((st, i) => node(st) + (i < steps.length - 1 ? conn : '')).join('')}
      </div>`;
  },

  // คำแนะนำปรับสัญญาณไฟจาก AI — ย่อเป็นบรรทัดเดียว/แถว เน้นสแกนง่าย
  renderSignals() {
    const m = this.sourceMeta();
    document.getElementById('tm-signals').innerHTML = `
      <h3 class="text-[11px] font-medium text-muted mb-2">AI ปรับสัญญาณไฟอัตโนมัติ</h3>
      <div class="space-y-1.5">
        ${this.data.trafficops.signalPlans.map(p => {
          const st = this.STEP_STATUS[p.status];
          return `
            <div class="flex items-center gap-2 rounded-lg bg-surface2 border border-line/10 px-2.5 py-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-semibold text-ink truncate">${Utils.esc(p.intersection)}</span>
                  <span class="badge ${st.badge} shrink-0">${st.label}</span>
                </div>
                <div class="text-[10px] text-ink2 leading-snug truncate">→ ${Utils.esc(p.recommendation)}</div>
              </div>
              ${p.expectedImprovementPct > 0 ? `
                <div class="shrink-0 text-right">
                  <div class="text-sm font-semibold tabular-nums leading-none" style="color:${m.signal.color}">-${p.expectedImprovementPct}%</div>
                  <div class="text-[9px] text-muted">เวลารอ</div>
                </div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  },

  // ไทม์ไลน์ย่อ: สปอตไลต์เหตุการณ์ที่กำลังดำเนินการ + รายการที่เหลือแบบบรรทัดเดียว
  renderTimeline() {
    const m = this.sourceMeta();
    const flow = this.data.trafficops.responseFlow;
    const active = flow.filter(e => e.status === 'active');
    const rest = flow.filter(e => e.status !== 'active');

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

    document.getElementById('tm-timeline').innerHTML = `
      ${spotlight}
      <h3 class="text-[11px] font-medium text-muted mb-2">ลำดับการตอบสนองอัตโนมัติวันนี้</h3>
      <div class="relative pl-[17px]">
        <span class="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-grid"></span>
        ${rows}
      </div>`;
  }
};
