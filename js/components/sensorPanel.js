// ตารางเซนเซอร์ IoT — คลิกแถวเพื่อดูตำแหน่งบนแผนที่
const SensorPanel = {
  init(data) {
    const sensors = data.sensors.sensors;
    this.renderSummary(sensors);
    this.renderTable(sensors, data.sensors.updatedAt);
  },

  renderSummary(sensors) {
    const count = st => sensors.filter(s => s.status === st).length;
    document.getElementById('sensor-summary').innerHTML = [
      Utils.badge({ ...CONFIG.STATUS.normal, label: `ปกติ ${count('normal')}` }),
      Utils.badge({ ...CONFIG.STATUS.warning, label: `เฝ้าระวัง ${count('warning')}` }),
      Utils.badge({ ...CONFIG.STATUS.critical, label: `วิกฤต ${count('critical')}` })
    ].join('');
  },

  // คอลัมน์ "ระดับ/เกณฑ์" — แถบมิเตอร์: ระดับน้ำเทียบเกณฑ์ หรือ WQI เทียบ 100
  meterCell(s) {
    const r = s.readings;
    let pct, color, label;
    if (r.waterLevel != null && (r.floodThreshold || r.tankCapacity)) {
      const cap = r.floodThreshold || r.tankCapacity;
      pct = Math.min(100, Math.round(r.waterLevel / cap * 100));
      color = r.floodThreshold
        ? (pct >= 85 ? CONFIG.COLORS.crit : pct >= 70 ? CONFIG.COLORS.warn : CONFIG.COLORS.s1)
        : CONFIG.COLORS.s1;
      label = `${pct}%`;
    } else if (s.wqi != null) {
      pct = s.wqi;
      color = pct >= 70 ? CONFIG.COLORS.s2 : pct >= 50 ? CONFIG.COLORS.warn : CONFIG.COLORS.crit;
      label = `WQI ${pct}`;
    } else {
      return '—';
    }
    return `
      <div class="flex items-center gap-2 min-w-[110px]">
        <div class="meter grow"><span style="width:${pct}%;background:${color}"></span></div>
        <span class="text-[10px] text-muted whitespace-nowrap">${label}</span>
      </div>`;
  },

  renderTable(sensors, nowIso) {
    const tbody = document.getElementById('sensor-table');
    tbody.innerHTML = sensors.map((s, i) => {
      const r = s.readings;
      const meta = CONFIG.STATUS[s.status];
      return `
        <tr data-idx="${i}">
          <td><div class="font-medium text-ink">${Utils.esc(s.name)}</div><div class="text-[10px] text-muted">${s.id}</div></td>
          <td>${CONFIG.SENSOR_TYPE[s.type]}</td>
          <td class="num">${r.ph != null ? r.ph.toFixed(1) : '—'}</td>
          <td class="num">${r.do != null ? r.do.toFixed(1) : '—'}</td>
          <td class="num">${r.turbidity != null ? r.turbidity.toFixed(1) : '—'}</td>
          <td class="num">${r.waterLevel != null ? r.waterLevel.toFixed(2) : '—'}</td>
          <td>${this.meterCell(s)}</td>
          <td>${Utils.badge(meta)}</td>
          <td class="text-[11px] text-muted whitespace-nowrap">${Utils.timeAgo(s.lastUpdate, nowIso)}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const s = sensors[+tr.dataset.idx];
        MapComponent.focus(s.lat, s.lng);
      });
    });
  }
};
