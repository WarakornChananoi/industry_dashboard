// สถานะระบบ SCADA / PLC / สถานีสูบน้ำ / ประตูน้ำ
const ScadaPanel = {
  init(data) {
    const s = data.scada;
    this.renderPlc(s.plc);
    this.renderTreatment(s.waterTreatment);
    this.renderPumps(s.pumpStations);
    this.renderValves(s.valves);
  },

  renderPlc(plc) {
    const meta = CONFIG.STATUS[plc.status];
    document.getElementById('plc-status').innerHTML = `
      <div class="flex items-center gap-2 text-[11px] text-muted">
        ${Utils.badge({ ...meta, label: 'PLC ' + meta.label })}
        <span>cycle ${plc.cycleTimeMs} ms · comm ${(plc.commHealth * 100).toFixed(1)}%</span>
      </div>`;
  },

  renderTreatment(t) {
    const items = [
      { label: 'ผลิตน้ำวันนี้', value: Utils.num(t.productionTodayM3), unit: 'ลบ.ม.' },
      { label: 'คลอรีนคงเหลือ', value: t.chlorineResidualMgL, unit: 'mg/L' },
      { label: 'พลังงานวันนี้', value: Utils.num(t.energyKwhToday), unit: 'kWh' },
      { label: 'ล้างย้อนระบบกรอง', value: t.backwashCycles, unit: 'ครั้ง' }
    ];
    document.getElementById('treatment-summary').innerHTML = items.map(i => `
      <div class="rounded-lg bg-surface2 border border-line/10 px-3 py-2">
        <div class="text-[10px] text-muted">${i.label}</div>
        <div class="text-sm font-semibold text-ink">${i.value} <span class="text-[10px] font-normal text-muted">${i.unit}</span></div>
      </div>
    `).join('');
  },

  renderPumps(stations) {
    const wrap = document.getElementById('pump-cards');
    wrap.innerHTML = stations.map(st => {
      const meta = CONFIG.STATUS[st.status];
      const rows = st.pumps.map(p => {
        const pm = CONFIG.STATUS[p.status];
        return `
          <tr>
            <td class="!py-1.5 font-medium text-ink">${p.id}</td>
            <td class="!py-1.5"><span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${pm.color}"></span>${pm.label}</span></td>
            <td class="!py-1.5 num">${p.flowRate ? Utils.num(p.flowRate) : '—'}</td>
            <td class="!py-1.5 num">${p.pressureBar ? p.pressureBar.toFixed(1) : '—'}</td>
            <td class="!py-1.5 num">${p.powerKw ? Utils.num(p.powerKw) : '—'}</td>
            <td class="!py-1.5 num">${Utils.num(p.runtimeHours)}</td>
          </tr>
          ${p.faultDesc ? `<tr><td colspan="6" class="!py-1 text-[11px]" style="color:${CONFIG.COLORS.crit}">⚠ ${p.faultCode}: ${Utils.esc(p.faultDesc)}</td></tr>` : ''}`;
      }).join('');

      return `
        <div class="rounded-lg bg-surface2 border border-line/10 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div>
              <span class="text-xs font-semibold text-ink">${Utils.esc(st.name)} <span class="text-muted font-normal">(${st.id})</span></span>
              <div class="text-[10px] text-muted">${Utils.esc(st.role)}</div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="badge badge-info">โหมด ${st.mode.toUpperCase()}</span>
              ${Utils.badge(meta)}
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead><tr>
                <th>ปั๊ม</th><th>สถานะ</th><th class="num">อัตราไหล (ลบ.ม./ชม.)</th>
                <th class="num">แรงดัน (bar)</th><th class="num">กำลัง (kW)</th><th class="num">ชม.ทำงาน</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');
  },

  renderValves(valves) {
    document.getElementById('valve-list').innerHTML = valves.map(v => `
      <div class="rounded-lg bg-surface2 border border-line/10 px-3 py-2">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-ink2">${Utils.esc(v.name)} <span class="text-muted">(${v.id} · ${v.mode.toUpperCase()})</span></span>
          <span class="font-semibold text-ink">เปิด ${v.openPercent}%</span>
        </div>
        <div class="meter mt-1.5"><span style="width:${v.openPercent}%;background:${CONFIG.COLORS.s1}"></span></div>
      </div>
    `).join('');
  }
};
