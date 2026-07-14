// แผนที่ GIS หลักของหน้าเฝ้าระวังน้ำท่วม
// ชั้นข้อมูล: โซนคาดการณ์น้ำท่วม (polygon) / เรดาร์ฝนเรียลไทม์ (กรมอุตุนิยมวิทยา) /
// เซนเซอร์ IoT / สถานีวัดฝน / สถานีสูบ SCADA / สถานีอากาศ / โรงงานที่ได้รับผลกระทบ / แนวคลอง
const GisMap = {
  map: null,
  layers: {},
  baseLayer: null,
  radarFrame: null, // เฟรมเรดาร์ล่าสุดจาก TMD API (แชร์ข้ามการ render ซ้ำ)
  currentBase: 'osm',
  offLayers: new Set(), // จำสถานะชั้นข้อมูลที่ผู้ใช้ปิดไว้ ข้ามการสลับธีม

  // แผนที่ฐาน (xyz tiles)
  BASEMAPS: {
    osm: {
      label: 'OpenStreetMap',
      url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    groad: {
      label: 'Google Maps',
      url: () => 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
      attribution: '&copy; Google'
    },
    gsat: {
      label: 'Google Satellite',
      url: () => 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: '&copy; Google'
    }
  },

  init(data) {
    this.data = data;
    let center = CONFIG.MAP_CENTER, zoom = CONFIG.MAP_ZOOM;
    if (this.map) {
      center = this.map.getCenter();
      zoom = this.map.getZoom();
      this.map.remove();
      document.getElementById('gis-basemaps').innerHTML = '';
      document.getElementById('gis-layers').innerHTML = '';
    }

    this.map = L.map('gis-map', { zoomControl: true }).setView(center, zoom);
    this.setBasemap(this.currentBase);

    const C = CONFIG.COLORS;
    this.layers = {
      floodzones: { group: this.buildFloodZoneLayer(data.floodzones), label: 'โซนคาดการณ์น้ำท่วม', color: C.crit },
      canal:      { group: this.buildCanalLayer(data.floodzones),     label: 'แนวคลองระบายน้ำ',   color: C.s1 },
      affected:   { group: this.buildAffectedLayer(data),             label: 'โรงงานได้รับผลกระทบ', color: C.serious },
      sensors:    { group: this.buildSensorLayer(data.sensors),       label: 'เซนเซอร์ IoT น้ำ',    color: C.s2 },
      rain:       { group: this.buildRainLayer(data.rainfall),        label: 'สถานีวัดฝน IoT',      color: C.s1 },
      pumps:      { group: this.buildPumpLayer(data.scada),           label: 'สถานีสูบ SCADA',      color: C.s5 },
      weather:    { group: this.buildWeatherLayer(data.weather),      label: 'สถานีอากาศ (อุตุฯ)',  color: C.s3 },
      radar:      { group: L.layerGroup(),                            label: 'เรดาร์ฝน (เรียลไทม์)', color: C.s1, async: true }
    };
    Object.entries(this.layers).forEach(([key, l]) => {
      if (!this.offLayers.has(key)) l.group.addTo(this.map);
    });

    this.renderBasemapChips();
    this.renderLayerChips();
    this.renderLegend();
    this.loadRadar(); // เรดาร์ฝนโหลดแบบ async — เติมลง layer group ทีหลัง
  },

  // ---------- แผนที่ฐาน ----------
  setBasemap(key) {
    const bm = this.BASEMAPS[key];
    if (!bm) return;
    this.currentBase = key;
    if (this.baseLayer) this.map.removeLayer(this.baseLayer);
    this.baseLayer = L.tileLayer(bm.url(), { attribution: bm.attribution, maxZoom: 19 });
    this.baseLayer.addTo(this.map);
    this.baseLayer.bringToBack();
  },

  renderBasemapChips() {
    const wrap = document.getElementById('gis-basemaps');
    Object.entries(this.BASEMAPS).forEach(([key, bm]) => {
      const chip = Utils.el(`
        <button class="layer-chip" data-off="${key === this.currentBase ? 'false' : 'true'}">${bm.label}</button>`);
      chip.addEventListener('click', () => {
        this.setBasemap(key);
        wrap.querySelectorAll('.layer-chip').forEach(c => c.dataset.off = 'true');
        chip.dataset.off = 'false';
      });
      wrap.appendChild(chip);
    });
  },

  // ---------- เรดาร์ฝนเรียลไทม์จากกรมอุตุนิยมวิทยา (TMD) ----------
  // ดึง timeline ล่าสุดจาก metadata endpoint ทุกครั้ง เพื่อไม่ให้ ref_time ค้าง/หมดอายุ (เฟรมอัปเดตทุก ~15 นาที)
  async loadRadar() {
    const timeBox = document.getElementById('gis-radar-time');
    try {
      if (!this.radarFrame) {
        const res = await fetch('https://wxmap.tmd.go.th/api/radar/tiles/metadata');
        if (!res.ok) throw new Error('radar api ' + res.status);
        const j = await res.json();
        const frames = j.timeline;
        if (!frames || !frames.length) throw new Error('no radar frames');
        this.radarFrame = frames[frames.length - 1]; // เฟรมล่าสุด
      }
      const f = this.radarFrame;
      L.tileLayer(`https://wxmap.tmd.go.th${f.tile_url}`, {
        opacity: 0.65, maxZoom: 19,
        attribution: '&copy; กรมอุตุนิยมวิทยา (TMD)'
      }).addTo(this.layers.radar.group);
      timeBox.classList.remove('hidden');
      timeBox.innerHTML = `<span class="dot bg-s1 inline-block align-middle mr-1"></span>
        เรดาร์ฝน กรมอุตุนิยมวิทยา · ${new Date(f.time_local).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    } catch (err) {
      // โหลดเรดาร์ไม่ได้ (ออฟไลน์/ API ล่ม) — ปิดชิปและแจ้งบนป้าย
      console.warn('โหลดเรดาร์ฝนไม่สำเร็จ:', err.message);
      timeBox.classList.remove('hidden');
      timeBox.textContent = 'เรดาร์ฝนเรียลไทม์ไม่พร้อมใช้งานขณะนี้';
    }
  },

  // ---------- โซนคาดการณ์น้ำท่วม (polygon จากโมเดล AI + DEM) ----------
  buildFloodZoneLayer(fz) {
    const group = L.layerGroup();
    this.zonePolys = {};
    fz.zones.forEach(z => {
      const meta = CONFIG.RISK[z.riskLevel];
      const poly = L.polygon(z.polygon, {
        color: meta.color, weight: 2, dashArray: '6 4',
        fillColor: meta.color, fillOpacity: 0.18
      }).addTo(group).bindPopup(this.zonePopup(z, meta), { maxWidth: 300 });
      // ป้ายชื่อโซนกลาง polygon
      poly.bindTooltip(`${z.id} · ${meta.label}`, {
        permanent: true, direction: 'center', className: 'zone-label'
      });
      this.zonePolys[z.id] = poly;
    });
    return group;
  },

  zonePopup(z, meta) {
    const names = z.affectedBuildings
      .map(id => {
        const b = this.data.buildings.buildings.find(x => x.id === id);
        return b ? `• ${Utils.esc(b.company)} (${id})` : `• ${id}`;
      }).join('<br>');
    return `
      <div class="popup-title">${Utils.esc(z.name)}</div>
      <div style="color:#898781">${z.id} · ความน่าจะเป็น ${Math.round(z.probability * 100)}%</div>
      <div style="margin-top:4px">
        ระดับความเสี่ยง: <b style="color:${meta.textColor || meta.color}">${meta.label}</b><br>
        น้ำลึกคาดการณ์ <b>${z.expectedDepthM} ม.</b> · เริ่มท่วมใน <b>~${z.etaHours} ชม.</b><br>
        พื้นที่ผลกระทบ <b>${Utils.num(z.areaRai)} ไร่</b>
      </div>
      ${names ? `<div style="margin-top:6px"><b>โรงงานในโซน:</b><br>${names}</div>` : ''}
      <div style="margin-top:6px;color:var(--warn-text)">⚠ ${Utils.esc(z.recommendation)}</div>`;
  },

  // ---------- แนวคลองระบายน้ำหลัก ----------
  buildCanalLayer(fz) {
    const group = L.layerGroup();
    const line = L.polyline(fz.canal.path, {
      color: CONFIG.COLORS.s1, weight: 4, opacity: 0.75, dashArray: '10 8', lineCap: 'round'
    }).addTo(group);
    line.bindPopup(`<div class="popup-title">${Utils.esc(fz.canal.name)}</div>
      <div style="margin-top:4px">รับน้ำจากประตูน้ำเหนือ (WL-101) ผ่านกลางเขต (WL-102)
      ระบายออกคลองเชียงรากใต้ (WL-103) ผ่านสถานีสูบ PS-03</div>`);
    return group;
  },

  // ---------- โรงงานที่คาดว่าจะได้รับผลกระทบ ----------
  buildAffectedLayer(data) {
    const group = L.layerGroup();
    data.floodzones.zones.forEach(z => {
      const meta = CONFIG.RISK[z.riskLevel];
      z.affectedBuildings.forEach(id => {
        const b = data.buildings.buildings.find(x => x.id === id);
        if (!b) return;
        const icon = L.divIcon({
          className: '',
          html: `<div class="${z.riskLevel === 'high' ? 'marker-critical' : ''}"
                   style="width:24px;height:24px;border-radius:7px;background:${meta.color};
                   border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;">
                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                     <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                   </svg></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12]
        });
        L.marker([b.lat, b.lng], { icon, zIndexOffset: 500 }).addTo(group).bindPopup(`
          <div class="popup-title">${Utils.esc(b.company)}</div>
          <div style="color:#898781">${b.id} · ${Utils.esc(b.type)} · โซนผัง ${b.zone}</div>
          <div style="margin-top:4px">
            อยู่ในโซนคาดการณ์ <b>${z.id}</b> — <b style="color:${meta.textColor || meta.color}">${meta.label}</b><br>
            น้ำลึกคาดการณ์ <b>${z.expectedDepthM} ม.</b> · เริ่มท่วมใน <b>~${z.etaHours} ชม.</b>
          </div>
          <div style="margin-top:6px;color:var(--warn-text)">⚠ แจ้งเตือนทาง SMS/LINE แล้ว — เตรียมย้ายทรัพย์สินชั้นล่าง</div>`);
      });
    });
    return group;
  },

  // ---------- เซนเซอร์ IoT (คุณภาพน้ำ / ระดับน้ำ) ----------
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
      if (r.waterLevel != null) {
        const th = r.floodThreshold ? ` / เกณฑ์ ${r.floodThreshold} ม.` : '';
        rows.push(`ระดับน้ำ <b>${r.waterLevel} ม.</b>${th}`);
      }
      if (r.ph != null) rows.push(`pH <b>${r.ph}</b> · DO <b>${r.do}</b> mg/L`);
      if (s.wqi != null) rows.push(`ดัชนีคุณภาพน้ำ (WQI) <b>${s.wqi}</b>/100`);
      L.marker([s.lat, s.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(s.name)}</div>
        <div style="color:#898781">${s.id} · ${CONFIG.SENSOR_TYPE[s.type]}</div>
        <div style="margin-top:4px">${rows.join('<br>')}</div>
        <div style="margin-top:6px">สถานะ: <b style="color:${meta.textColor || meta.color}">${meta.label}</b> · ${Utils.timeHM(s.lastUpdate)} น.</div>`);
    });
    return group;
  },

  // ---------- สถานีวัดฝน IoT ----------
  buildRainLayer(rainfall) {
    const group = L.layerGroup();
    rainfall.gauges.forEach(g => {
      const meta = CONFIG.STATUS[g.status];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:${CONFIG.COLORS.s1};
                 border:2px solid ${meta.color};display:flex;align-items:center;justify-content:center;">
                 <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.7 6.6 9.5a6.5 6.5 0 1 0 10.8 0Z"/></svg>
               </div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
      });
      L.marker([g.lat, g.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(g.name)}</div>
        <div style="color:#898781">${g.id} · แบตเตอรี่ ${g.batteryPct}%</div>
        <div style="margin-top:4px">
          ฝน 1 ชม. <b>${g.rain1hMm} มม.</b> (${RainPanel.intensityLabel(g.rain1hMm)})<br>
          สะสม 3 ชม. <b>${g.rain3hMm} มม.</b> · 24 ชม. <b>${g.rain24hMm} มม.</b>
        </div>
        <div style="margin-top:6px">สถานะ: <b style="color:${meta.textColor || meta.color}">${meta.label}</b> · ${Utils.timeHM(g.lastUpdate)} น.</div>`);
    });
    return group;
  },

  // ---------- สถานีสูบ SCADA ----------
  buildPumpLayer(scada) {
    const group = L.layerGroup();
    scada.pumpStations.forEach(st => {
      const meta = CONFIG.STATUS[st.status];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:6px;background:var(--surface-2);
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
        <div style="margin-top:4px">${pumpRows}</div>`);
    });
    return group;
  },

  // ---------- สถานีตรวจอากาศ (กรมอุตุฯ + IoT ในเขต) ----------
  buildWeatherLayer(weather) {
    const group = L.layerGroup();
    weather.stations.forEach(w => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;gap:4px;background:var(--surface);
                 border:1.5px solid ${CONFIG.COLORS.s3};border-radius:9999px;padding:2px 8px 2px 4px;
                 box-shadow:0 2px 6px rgba(0,0,0,.25);white-space:nowrap;">
                 <span style="width:16px;height:16px;border-radius:9999px;background:${CONFIG.COLORS.s3};
                   display:inline-flex;align-items:center;justify-content:center;">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
                     <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>
                   </svg></span>
                 <span style="font-size:11px;font-weight:600;color:var(--ink)">${w.tempC.toFixed(0)}°</span>
               </div>`,
        iconSize: [58, 22], iconAnchor: [29, 11]
      });
      L.marker([w.lat, w.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(w.name)}</div>
        <div style="color:#898781">${w.id} · ${Utils.esc(w.operator)}</div>
        <div style="margin-top:4px">
          อุณหภูมิ <b>${w.tempC}°C</b> · ความชื้น <b>${w.humidityPct}%</b><br>
          ลม <b>${w.windKmh} กม./ชม.</b> · ฝนสะสม 24 ชม. <b>${w.rain24hMm} มม.</b>
        </div>`);
    });
    return group;
  },

  // ---------- ชิปเปิด/ปิดชั้นข้อมูล ----------
  renderLayerChips() {
    const wrap = document.getElementById('gis-layers');
    Object.entries(this.layers).forEach(([key, l]) => {
      const chip = Utils.el(`
        <button class="layer-chip" data-off="${this.offLayers.has(key)}">
          <span class="dot" style="background:${l.color}"></span>${l.label}
        </button>`);
      chip.addEventListener('click', () => {
        const off = chip.dataset.off === 'true';
        chip.dataset.off = String(!off);
        if (off) {
          this.offLayers.delete(key);
          l.group.addTo(this.map);
        } else {
          this.offLayers.add(key);
          this.map.removeLayer(l.group);
        }
      });
      wrap.appendChild(chip);
    });
  },

  renderLegend() {
    const C = CONFIG.COLORS;
    const items = [
      [C.crit, 'โซนเสี่ยงสูง'], [C.warn, 'โซนเสี่ยงปานกลาง'], [C.good, 'โซนเฝ้าระวัง'],
      [C.serious, 'โรงงานได้รับผลกระทบ'], [C.s2, 'เซนเซอร์น้ำ'], [C.s1, 'สถานีวัดฝน / แนวคลอง'],
      [C.s5, 'สถานีสูบ'], [C.s3, 'สถานีอากาศ']
    ];
    document.getElementById('gis-legend').innerHTML = items.map(([c, t]) =>
      `<span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${c}"></span>${t}</span>`
    ).join('');
  },

  // ซูมไปยังโซนน้ำท่วม (เรียกจาก FloodAlertPanel)
  focusZone(zoneId) {
    const poly = this.zonePolys && this.zonePolys[zoneId];
    if (!poly) return;
    document.getElementById('gis-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyToBounds(poly.getBounds(), { padding: [40, 40], duration: 0.8 });
    setTimeout(() => poly.openPopup(), 900);
  },

  // ซูมไปยังพิกัด (เช่นโรงงาน)
  focus(lat, lng, zoom = 17) {
    if (!this.map || lat == null) return;
    document.getElementById('gis-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }
};
