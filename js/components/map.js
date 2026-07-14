// แผนที่ Leaflet: เซนเซอร์ IoT / จุดเสี่ยงน้ำท่วม (AI) / สถานีสูบ / อาคาร+มิเตอร์
const MapComponent = {
  map: null,
  layers: {},

  init(data) {
    // render ซ้ำได้ (เช่นตอนสลับธีม): เก็บ view เดิม รื้อแผนที่เก่าก่อนสร้างใหม่
    let center = CONFIG.MAP_CENTER, zoom = CONFIG.MAP_ZOOM;
    if (this.map) {
      center = this.map.getCenter();
      zoom = this.map.getZoom();
      this.map.remove();
      document.getElementById('map-layers').innerHTML = '';
    }

    this.map = L.map('map', { zoomControl: true }).setView(center, zoom);
    // basemap สลับตามธีม (dark_all / light_all)
    L.tileLayer(CONFIG.COLORS.tileUrl, { attribution: CONFIG.TILE_ATTRIBUTION, maxZoom: 19 }).addTo(this.map);

    this.layers = {
      sensors:   { group: this.buildSensorLayer(data.sensors),      label: 'เซนเซอร์ IoT',    color: CONFIG.COLORS.s2 },
      risk:      { group: this.buildRiskLayer(data.predictions),    label: 'จุดเสี่ยงน้ำท่วม (AI)', color: CONFIG.COLORS.s3 },
      pumps:     { group: this.buildPumpLayer(data.scada),          label: 'สถานีสูบ SCADA',  color: CONFIG.COLORS.s5 },
      buildings: { group: this.buildBuildingLayer(data.buildings),  label: 'อาคาร / มิเตอร์', color: CONFIG.COLORS.s1 }
    };
    Object.values(this.layers).forEach(l => l.group.addTo(this.map));

    this.renderLayerChips();
    this.renderLegend();
  },

  // ---------- ชั้นข้อมูล: เซนเซอร์ ----------
  buildSensorLayer(sensorsData) {
    const group = L.layerGroup();
    sensorsData.sensors.forEach(s => {
      const meta = CONFIG.STATUS[s.status];
      const icon = L.divIcon({
        className: '',
        html: `<div class="${s.status === 'critical' ? 'marker-critical' : ''}"
                 style="width:14px;height:14px;border-radius:9999px;background:${meta.color};
                 border:2px solid var(--surface);"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      });
      const r = s.readings;
      const rows = [];
      if (r.ph != null) rows.push(`pH <b>${r.ph}</b> · DO <b>${r.do}</b> mg/L · ขุ่น <b>${r.turbidity}</b> NTU`);
      if (s.wqi != null) rows.push(`ดัชนีคุณภาพน้ำ (WQI) <b>${s.wqi}</b>/100`);
      if (r.waterLevel != null) {
        const th = r.floodThreshold ? ` / เกณฑ์ ${r.floodThreshold} ม.` : (r.tankCapacity ? ` / ความจุ ${r.tankCapacity} ม.` : '');
        rows.push(`ระดับน้ำ <b>${r.waterLevel} ม.</b>${th}`);
      }
      L.marker([s.lat, s.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(s.name)}</div>
        <div style="color:#898781">${s.id} · ${CONFIG.SENSOR_TYPE[s.type]}</div>
        <div style="margin-top:4px">${rows.join('<br>')}</div>
        <div style="margin-top:6px">สถานะ: <b style="color:${meta.textColor || meta.color}">${meta.label}</b> · ${Utils.timeHM(s.lastUpdate)} น.</div>
      `);
    });
    return group;
  },

  // ---------- ชั้นข้อมูล: จุดเสี่ยงน้ำท่วมจาก AI ----------
  buildRiskLayer(predictions) {
    const group = L.layerGroup();
    predictions.stations.forEach(st => {
      const meta = CONFIG.RISK[st.riskLevel];
      L.circle([st.lat, st.lng], {
        radius: 140 + st.riskScore * 220,
        color: meta.color, weight: 1.5, dashArray: '4 4',
        fillColor: meta.color, fillOpacity: 0.13
      }).addTo(group).bindPopup(`
        <div class="popup-title">คาดการณ์น้ำท่วม — ${Utils.esc(st.name)}</div>
        <div style="color:#898781">${st.stationId} · ${predictions.model}</div>
        <div style="margin-top:4px">
          ระดับปัจจุบัน <b>${st.currentLevel} ม.</b> / เกณฑ์ <b>${st.floodThreshold} ม.</b><br>
          คาดการณ์สูงสุด <b>${st.peakLevel} ม.</b> ที่ <b>${st.peakAt}</b><br>
          คะแนนความเสี่ยง <b>${Math.round(st.riskScore * 100)}%</b>
        </div>
        <div style="margin-top:6px">ระดับความเสี่ยง: <b style="color:${meta.textColor || meta.color}">${meta.label}</b></div>
      `);
    });
    return group;
  },

  // ---------- ชั้นข้อมูล: สถานีสูบ SCADA ----------
  buildPumpLayer(scada) {
    const group = L.layerGroup();
    scada.pumpStations.forEach(st => {
      const meta = CONFIG.STATUS[st.status];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:6px;background:#222221;
                 border:2px solid ${meta.color};display:flex;align-items:center;justify-content:center;">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2.5">
                   <circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                 </svg></div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
      });
      const pumpRows = st.pumps.map(p => {
        const pm = CONFIG.STATUS[p.status];
        const extra = p.status === 'running' ? ` — ${p.flowRate} ลบ.ม./ชม.` : (p.faultDesc ? ` — ${p.faultDesc}` : '');
        return `<span style="color:${pm.color}">●</span> ${p.id} ${pm.label}${extra}`;
      }).join('<br>');
      L.marker([st.lat, st.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(st.name)} (${st.id})</div>
        <div style="color:#898781">${Utils.esc(st.role)} · โหมด ${st.mode.toUpperCase()}</div>
        <div style="margin-top:4px">${pumpRows}</div>
      `);
    });
    return group;
  },

  // ---------- ชั้นข้อมูล: อาคาร + มิเตอร์น้ำ ----------
  buildBuildingLayer(buildingsData) {
    const group = L.layerGroup();
    const list = buildingsData.buildings;
    const max = Math.max(...list.map(b => b.usage.lastMonthM3));
    // ไล่สีน้ำเงินตามปริมาณการใช้ (sequential ramp)
    const ramp = ['#86b6ef', '#5598e7', '#3987e5', '#256abf', '#1c5cab'];

    list.forEach(b => {
      const ratio = b.usage.lastMonthM3 / max;
      const size = Math.round(20 + ratio * 18);
      const color = ramp[Math.min(ramp.length - 1, Math.floor(ratio * ramp.length))];
      const icon = L.divIcon({
        className: '',
        html: `<div class="bld-marker" style="width:${size}px;height:${size}px;background:${color};">${b.id.replace('B-', '')}</div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2]
      });
      const bill = DataService.computeBill(b, buildingsData.rateConfig);
      const bs = CONFIG.BILL_STATUS[b.billStatus];
      L.marker([b.lat, b.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(b.company)}</div>
        <div style="color:#898781">${b.id} · ${Utils.esc(b.type)} · โซน ${b.zone} · มิเตอร์ ${b.meterId}</div>
        <div style="margin-top:4px">
          ใช้น้ำวันนี้ <b>${Utils.num(b.usage.todayM3)} ลบ.ม.</b><br>
          รอบบิล ${buildingsData.billingPeriodLabel} <b>${Utils.num(b.usage.lastMonthM3)} ลบ.ม.</b><br>
          ยอดบิล <b>${Utils.baht(bill.total, 2)}</b> · <b>${bs.label}</b>
        </div>
        ${b.note ? `<div style="margin-top:6px;color:var(--warn-text)">⚠ ${Utils.esc(b.note)}</div>` : ''}
      `);
    });
    return group;
  },

  // ---------- ปุ่มเปิด/ปิดชั้นข้อมูล ----------
  renderLayerChips() {
    const wrap = document.getElementById('map-layers');
    Object.entries(this.layers).forEach(([key, l]) => {
      const chip = Utils.el(`
        <button class="layer-chip" data-off="false">
          <span class="dot" style="background:${l.color}"></span>${l.label}
        </button>`);
      chip.addEventListener('click', () => {
        const off = chip.dataset.off === 'true';
        chip.dataset.off = String(!off);
        off ? l.group.addTo(this.map) : this.map.removeLayer(l.group);
      });
      wrap.appendChild(chip);
    });
  },

  renderLegend() {
    const items = [
      ['#0ca30c', 'ปกติ'], ['#fab219', 'เฝ้าระวัง'], ['#d03b3b', 'วิกฤต / ขัดข้อง'],
      [CONFIG.COLORS.s1, 'ขนาด/ความเข้มหมุดอาคาร = ปริมาณใช้น้ำ']
    ];
    document.getElementById('map-legend').innerHTML = items.map(([c, t]) =>
      `<span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${c}"></span>${t}</span>`
    ).join('');
  },

  // เลื่อนแผนที่ไปยังตำแหน่งที่ระบุ (เรียกจาก component อื่น)
  focus(lat, lng, zoom = 17) {
    if (!this.map || lat == null) return;
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }
};
