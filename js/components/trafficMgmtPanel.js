// ศูนย์บริหารจัดการจราจร: เป้าหมายคือ "ลดการจราจรติดขัด เพิ่มความปลอดภัย"
// แผนผังการทำงานร่วมกัน (ตรวจจับ → AI วิเคราะห์ → สั่งการ/แจ้งเตือน → ผลลัพธ์)
// + คำแนะนำปรับสัญญาณไฟจาก AI + ไทม์ไลน์การตอบสนองอัตโนมัติ
const TrafficMgmtPanel = {
  // สี/ไอคอนของแหล่งข้อมูลแต่ละประเภทในไทม์ไลน์
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

  init(data) {
    this.data = data;
    this.renderPipeline();
    this.renderSignals();
    this.renderTimeline();
  },

  // แผนผัง 4 ขั้น: อุปกรณ์/ระบบที่ทำงานเชื่อมโยงกันขณะนี้
  renderPipeline() {
    const d = this.data;
    const m = this.sourceMeta();
    const s = d.trafficops.summary;
    const detect = s.camerasOnline + s.sensorsOnline;
    const analyzed = d.trafficops.events.length;
    const actions = d.trafficops.signalPlans.filter(p => p.status !== 'pending').length
      + d.trafficops.events.filter(e => e.status === 'active').length;
    const avgImprove = Math.round(
      d.trafficops.signalPlans.reduce((sum, p) => sum + p.expectedImprovementPct, 0) /
      d.trafficops.signalPlans.filter(p => p.expectedImprovementPct > 0).length);

    const steps = [
      { key: 'cctv', title: 'ตรวจจับ', value: detect, unit: 'กล้อง + sensor', desc: 'CCTV · LPR · GPS · radar' },
      { key: 'ai', title: 'AI วิเคราะห์', value: analyzed, unit: 'เหตุการณ์วันนี้', desc: 'ติดตามรถ · คาดการณ์คิว' },
      { key: 'signal', title: 'สั่งการ / แจ้งเตือน', value: actions, unit: 'รายการ', desc: 'สัญญาณไฟ · VMS · LINE' },
      { key: 'alert', title: 'ผลลัพธ์', value: `-${avgImprove}%`, unit: 'เวลารอเฉลี่ย', desc: 'ลดติดขัด · เพิ่มปลอดภัย' }
    ];

    document.getElementById('tm-pipeline').innerHTML = `
      <div class="grid grid-cols-4 gap-1.5">
        ${steps.map((st, i) => `
          <div class="relative rounded-lg bg-surface2 border border-line/10 p-2 text-center">
            <div class="w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1"
                 style="background:${m[st.key].color}1f;border:1px solid ${m[st.key].color}55">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${m[st.key].color}"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[st.key].icon}</svg>
            </div>
            <div class="text-[10px] font-medium text-ink leading-tight">${st.title}</div>
            <div class="text-base font-semibold tabular-nums" style="color:${m[st.key].color}">${st.value}</div>
            <div class="text-[9px] text-muted leading-tight">${st.unit}</div>
            <div class="text-[9px] text-muted leading-tight mt-0.5 hidden sm:block">${st.desc}</div>
            ${i < steps.length - 1 ? `
              <span class="absolute top-1/2 -right-[7px] -translate-y-1/2 z-10 text-muted">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>
              </span>` : ''}
          </div>`).join('')}
      </div>`;
  },

  // คำแนะนำปรับสัญญาณไฟจาก AI (ลดการติดขัดเชิงรุก)
  renderSignals() {
    const m = this.sourceMeta();
    document.getElementById('tm-signals').innerHTML = `
      <h3 class="text-xs font-medium text-ink2 mb-2">AI ปรับสัญญาณไฟอัตโนมัติ</h3>
      <div class="space-y-1.5">
        ${this.data.trafficops.signalPlans.map(p => {
          const st = this.STEP_STATUS[p.status];
          return `
            <div class="rounded-lg bg-surface2 border border-line/10 p-2.5">
              <div class="flex items-center justify-between gap-2 mb-0.5">
                <span class="text-[11px] font-semibold text-ink">${Utils.esc(p.intersection)}</span>
                <span class="badge ${st.badge}">${st.label}</span>
              </div>
              <div class="text-[10px] text-muted">${Utils.esc(p.currentPlan)}</div>
              <div class="flex items-center justify-between gap-2 mt-1">
                <span class="text-[10.5px] text-ink2 leading-snug flex-1">→ ${Utils.esc(p.recommendation)}</span>
                ${p.expectedImprovementPct > 0 ? `
                  <span class="shrink-0 text-[10.5px] font-semibold tabular-nums" style="color:${m.signal.color}">
                    -${p.expectedImprovementPct}% เวลารอ</span>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ไทม์ไลน์การตอบสนองอัตโนมัติ (จากข้อมูล responseFlow)
  renderTimeline() {
    const m = this.sourceMeta();
    document.getElementById('tm-timeline').innerHTML = `
      <h3 class="text-xs font-medium text-ink2 mb-2">ลำดับเหตุการณ์ตอบสนองอัตโนมัติวันนี้</h3>
      <div class="relative pl-5">
        <span class="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-grid"></span>
        ${this.data.trafficops.responseFlow.map(ev => {
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
