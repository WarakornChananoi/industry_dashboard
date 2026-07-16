// แผนที่จราจรอัจฉริยะ (Smart Traffic GIS)
// แผนที่ฐานหลัก: Google Traffic (ความหนาแน่นจราจรเรียลไทม์) + ชั้นข้อมูล:
// สภาพถนนจาก sensor (LOS) / กล้อง AI CCTV·LPR / Sensor จราจร / เส้นทางติดตามรถ / เหตุการณ์
const TrafficMap = {
  map: null,
  layers: {},
  baseLayer: null,
  currentBase: 'gtraffic',
  offLayers: new Set(), // จำสถานะชั้นข้อมูลที่ผู้ใช้ปิดไว้ ข้ามการสลับธีม

  // แผนที่ฐาน (xyz tiles) — Google Traffic เป็นค่าเริ่มต้นตามโจทย์ของหน้านี้
  BASEMAPS: {
    gtraffic: {
      label: 'Google Traffic',
      url: () => 'https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}',
      attribution: '&copy; Google — ข้อมูลจราจรเรียลไทม์'
    },
    osm: {
      label: 'OpenStreetMap',
      url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    gsat: {
      label: 'Google Satellite',
      url: () => 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: '&copy; Google'
    }
  },

  // สีประจำรถแต่ละคัน: รถสถานะ watch/alert ใช้สีสถานะ (เน้นความปลอดภัย)
  // รถปกติใช้สีชุด categorical ตามลำดับคงที่
  vehicleColor(v) {
    const C = CONFIG.COLORS;
    if (v.status === 'alert') return C.crit;
    if (v.status === 'watch') return C.warn;
    const order = ['VH-01', 'VH-02', 'VH-05'];
    return [C.s1, C.s2, C.s5][order.indexOf(v.id)] || C.s1;
  },

  init(data) {
    this.data = data;
    let center = CONFIG.MAP_CENTER, zoom = CONFIG.MAP_ZOOM;
    if (this.map) {
      center = this.map.getCenter();
      zoom = this.map.getZoom();
      this.map.remove();
      document.getElementById('tf-basemaps').innerHTML = '';
      document.getElementById('tf-layers').innerHTML = '';
    }

    this.map = L.map('tf-map', { zoomControl: true }).setView(center, zoom);
    this.setBasemap(this.currentBase);

    const C = CONFIG.COLORS;
    this.layers = {
      segments:  { group: this.buildSegmentLayer(data.trafficsensors),  label: 'สภาพถนน (LOS จาก sensor)', color: C.serious },
      vehicles:  { group: this.buildVehicleLayer(data.vehicles),        label: 'เส้นทางติดตามรถ',          color: C.s1 },
      cameras:   { group: this.buildCameraLayer(data.cctv),             label: 'กล้อง AI CCTV / LPR',      color: C.s5 },
      sensors:   { group: this.buildSensorLayer(data.trafficsensors),   label: 'Sensor จราจร',             color: C.s2 },
      incidents: { group: this.buildIncidentLayer(data.trafficops),     label: 'เหตุการณ์',                color: C.crit }
    };
    Object.entries(this.layers).forEach(([key, l]) => {
      if (!this.offLayers.has(key)) l.group.addTo(this.map);
    });

    this.renderBasemapChips();
    this.renderLayerChips();
    this.renderLegend();
    this.renderLiveBadge();
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
    this.renderLiveBadge();
  },

  renderBasemapChips() {
    const wrap = document.getElementById('tf-basemaps');
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

  renderLiveBadge() {
    const box = document.getElementById('tf-live-badge');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = this.currentBase === 'gtraffic'
      ? `<span class="dot bg-good inline-block align-middle mr-1"></span>
         ความหนาแน่นจราจร Google — เรียลไทม์ · อัปเดตอัตโนมัติ`
      : `<span class="dot bg-s2 inline-block align-middle mr-1"></span>
         เปิดชั้น Google Traffic เพื่อดูความหนาแน่นจราจรเรียลไทม์`;
  },

  // ---------- สภาพถนนตามระดับการให้บริการ (LOS) จาก sensor ----------
  buildSegmentLayer(ts) {
    const group = L.layerGroup();
    this.segmentLines = {};
    ts.roadSegments.forEach(seg => {
      const meta = CONFIG.LOS[seg.los];
      // เส้นพื้นสีเข้มช่วยให้เส้น LOS อ่านง่ายบนแผนที่ทุกแบบ
      L.polyline(seg.path, { color: 'rgba(0,0,0,.35)', weight: 9, lineCap: 'round' }).addTo(group);
      const line = L.polyline(seg.path, {
        color: meta.color, weight: 5, opacity: 0.9, lineCap: 'round'
      }).addTo(group);
      line.bindPopup(`
        <div class="popup-title">${Utils.esc(seg.name)}</div>
        <div style="color:#898781">${seg.id}</div>
        <div style="margin-top:4px">
          สภาพจราจร: <b style="color:${meta.textColor || meta.color}">${meta.label}</b><br>
          ความเร็วเฉลี่ย <b>${seg.speedKmh} กม./ชม.</b> · ความล่าช้า <b>+${seg.delayMin} นาที</b>
        </div>`);
      line.bindTooltip(`${meta.label} · ${seg.speedKmh} กม./ชม.`, { sticky: true });
      this.segmentLines[seg.id] = line;
    });
    return group;
  },

  // ---------- กล้อง AI CCTV / LPR ----------
  buildCameraLayer(cctv) {
    const group = L.layerGroup();
    this.camMarkers = {};
    cctv.cameras.forEach(cam => {
      const C = CONFIG.COLORS;
      const isLpr = cam.type !== 'ai_cctv';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:26px;height:26px;border-radius:8px;background:${C.s5};
                 border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M2 8.5 15 5l1 3.8-13 3.5Z"/><path d="M8.6 11.2 8 14h8l-.7-4.6"/><path d="M12 14v4M8 21h8"/>
                   <circle cx="18.5" cy="7" r="1" fill="#fff"/>
                 </svg></div>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      });
      const marker = L.marker([cam.lat, cam.lng], { icon, zIndexOffset: 400 }).addTo(group);
      marker.bindPopup(`
        <div class="popup-title">${Utils.esc(cam.name)}</div>
        <div style="color:#898781">${cam.id} · ${isLpr ? 'AI CCTV + LPR' : 'AI CCTV'} · <b style="color:${C.good}">● ออนไลน์</b></div>
        <div style="margin-top:4px">
          ปริมาณรถ <b>${Utils.num(cam.vehiclesPerHr)} คัน/ชม.</b> · ความเร็วเฉลี่ย <b>${cam.avgSpeedKmh} กม./ชม.</b><br>
          LPR อ่านป้าย <b>${Utils.num(cam.lprReadsPerHr)} ป้าย/ชม.</b> (แม่นยำ ${(cam.lprAccuracy * 100).toFixed(1)}%)
        </div>
        <div style="margin-top:6px;color:#898781">AI: ${cam.aiFeatures.map(f => Utils.esc(f)).join(' · ')}</div>
        <div style="margin-top:6px"><a href="#cw-grid" onclick="CctvWall.show('${cam.id}');return false;"
          style="color:${C.s1};font-weight:600">▶ ดูภาพสดบนแผงควบคุม CCTV</a></div>`);
      this.camMarkers[cam.id] = marker;
    });
    return group;
  },

  // ---------- Sensor จราจร (loop / radar / bluetooth) ----------
  buildSensorLayer(ts) {
    const group = L.layerGroup();
    ts.sensors.forEach(s => {
      const meta = CONFIG.LOS[s.los];
      const icon = L.divIcon({
        className: '',
        html: `<div class="${s.los === 'jam' ? 'marker-critical' : ''}"
                 style="width:20px;height:20px;border-radius:9999px;background:var(--surface-2);
                 border:2.5px solid ${meta.color};display:flex;align-items:center;justify-content:center;">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2.5" stroke-linecap="round">
                   <path d="M12 20v-6M7.8 8.8a6 6 0 0 1 8.4 0M4.9 5.9a10 10 0 0 1 14.2 0"/>
                 </svg></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10]
      });
      L.marker([s.lat, s.lng], { icon }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(s.name)}</div>
        <div style="color:#898781">${s.id} · ${s.typeLabel} · ${Utils.esc(s.road)} (${s.direction})</div>
        <div style="margin-top:4px">
          ปริมาณ <b>${Utils.num(s.volumePerHr)}</b> / ความจุ ${Utils.num(s.capacityPerHr)} คัน/ชม.<br>
          ความเร็วเฉลี่ย <b>${s.avgSpeedKmh} กม./ชม.</b> · Occupancy <b>${s.occupancyPct}%</b>
        </div>
        <div style="margin-top:6px">สภาพจราจร: <b style="color:${meta.textColor || meta.color}">${meta.label}</b> · ${Utils.timeHM(s.lastUpdate)} น.</div>`);
    });
    return group;
  },

  // ---------- เส้นทางติดตามรถ (GPS ต่อเนื่อง / LPR ตรวจจับข้ามกล้อง) ----------
  buildVehicleLayer(vd) {
    const group = L.layerGroup();
    this.vehicleTracks = {};
    vd.vehicles.forEach(v => {
      const color = this.vehicleColor(v);
      const latlngs = v.track.map(p => [p.lat, p.lng]);
      const isLpr = v.source === 'lpr';

      // เส้นทาง: GPS = เส้นทึบ (ตำแหน่งต่อเนื่อง) / LPR = เส้นประ (คาดคะเนระหว่างกล้อง)
      const line = L.polyline(latlngs, {
        color, weight: 3.5, opacity: 0.85,
        dashArray: isLpr ? '7 7' : null, lineCap: 'round'
      }).addTo(group);

      // จุดตรวจจับระหว่างทาง
      v.track.slice(0, -1).forEach(p => {
        L.circleMarker([p.lat, p.lng], {
          radius: 4, color: 'var(--surface)', weight: 1.5, fillColor: color, fillOpacity: 1
        }).addTo(group).bindTooltip(`${v.plate} · ${p.t} น.`);
      });

      // หัวขบวน: ไอคอนรถ + ป้ายทะเบียน
      const head = v.track[v.track.length - 1];
      const glyph = {
        truck: '<path d="M1.5 7h12v8h-12zM13.5 10h4.2l3 3v2h-3"/><circle cx="6" cy="17.2" r="1.8"/><circle cx="17" cy="17.2" r="1.8"/>',
        van:   '<path d="M2.5 8h13l4.5 4v4H2.5zM8 8v4M14 8v4"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
        car:   '<path d="M4 12 6 7.5A2 2 0 0 1 7.9 6h6.2A2 2 0 0 1 16 7.5L18 12"/><path d="M3.5 12h17a1 1 0 0 1 1 1v3h-19v-3a1 1 0 0 1 1-1Z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
        pickup:'<path d="M2 8h9v5H2zM11 10h5l3.5 2.5V15H11z"/><circle cx="6" cy="16.8" r="1.7"/><circle cx="16.5" cy="16.8" r="1.7"/>'
      }[v.vehicleClass] || '';
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;">
                 <div class="${v.status === 'alert' ? 'marker-critical' : ''}"
                   style="width:26px;height:26px;border-radius:9999px;background:${color};
                   border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;">
                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
                 </div>
                 <span style="font-size:10px;font-weight:600;color:var(--ink);background:var(--surface);
                   border:1px solid ${color};border-radius:5px;padding:1px 5px;box-shadow:0 1px 4px rgba(0,0,0,.25)">${Utils.esc(v.plate)}</span>
               </div>`,
        iconSize: [90, 26], iconAnchor: [13, 13]
      });
      const st = CONFIG.VEHICLE_STATUS[v.status];
      const detections = (v.detections || []).map(d => {
        const cam = this.data.cctv.cameras.find(c => c.id === d.camId);
        return `• ${Utils.timeHM(d.time)} น. — ${d.camId} ${cam ? Utils.esc(cam.name.split(' — ')[0]) : ''} (${Math.round(d.confidence * 100)}%)`;
      }).join('<br>');
      const marker = L.marker([head.lat, head.lng], { icon, zIndexOffset: 700 }).addTo(group);
      marker.bindPopup(`
        <div class="popup-title">${Utils.esc(v.plate)} ${Utils.esc(v.province)}</div>
        <div style="color:#898781">${v.id} · ${Utils.esc(v.type)} · ติดตามด้วย ${v.source === 'gps' ? 'GPS' : 'LPR ข้ามกล้อง'}</div>
        <div style="margin-top:4px">
          สถานะ: <b style="color:${st.textColor || st.color}">${st.label}</b> ·
          ความเร็ว <b>${v.speedKmh} กม./ชม.</b> · ล่าสุด ${Utils.timeHM(v.lastSeen)} น.
        </div>
        ${detections ? `<div style="margin-top:6px"><b>ลำดับการตรวจจับ (LPR):</b><br>${detections}</div>` : ''}
        <div style="margin-top:6px;color:${v.status === 'normal' ? '#898781' : 'var(--warn-text)'}">${v.status === 'normal' ? '' : '⚠ '}${Utils.esc(v.note)}</div>`,
        { maxWidth: 300 });
      this.vehicleTracks[v.id] = { line, marker };
    });
    return group;
  },

  // ---------- เหตุการณ์ (อุบัติเหตุ / ติดขัด / ฝ่าฝืน) ----------
  buildIncidentLayer(ops) {
    const group = L.layerGroup();
    ops.events.filter(e => e.status !== 'resolved').forEach(ev => {
      const meta = CONFIG.SEVERITY[ev.severity];
      const icon = L.divIcon({
        className: '',
        html: `<div class="${ev.severity === 'critical' ? 'marker-critical' : ''}"
                 style="width:24px;height:24px;border-radius:7px;background:${meta.color};
                 border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                 </svg></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      });
      L.marker([ev.lat, ev.lng], { icon, zIndexOffset: 600 }).addTo(group).bindPopup(`
        <div class="popup-title">${Utils.esc(ev.title)}</div>
        <div style="color:#898781">${ev.id} · ${Utils.esc(ev.type)} · ${Utils.timeHM(ev.time)} น.</div>
        <div style="margin-top:4px">${Utils.esc(ev.detail)}</div>
        <div style="margin-top:6px">ความรุนแรง: <b style="color:${meta.textColor || meta.color}">${meta.label}</b></div>`,
        { maxWidth: 300 });
    });
    return group;
  },

  // ---------- ชิปเปิด/ปิดชั้นข้อมูล ----------
  renderLayerChips() {
    const wrap = document.getElementById('tf-layers');
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
      [CONFIG.LOS.free.color, 'คล่องตัว'], [CONFIG.LOS.busy.color, 'ชะลอตัว'],
      [CONFIG.LOS.heavy.color, 'หนาแน่น'], [CONFIG.LOS.jam.color, 'ติดขัดหนัก'],
      [C.s5, 'กล้อง AI CCTV / LPR'], [C.s2, 'Sensor จราจร'],
      [C.s1, 'เส้นทางรถ (ทึบ=GPS · ประ=LPR)'], [C.crit, 'เหตุการณ์ / รถเฝ้าระวัง']
    ];
    document.getElementById('tf-legend').innerHTML = items.map(([c, t]) =>
      `<span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${c}"></span>${t}</span>`
    ).join('');
  },

  // ซูมไปยังเส้นทางรถ (เรียกจาก VehicleTrackPanel)
  focusVehicle(vehicleId) {
    const t = this.vehicleTracks && this.vehicleTracks[vehicleId];
    if (!t) return;
    document.getElementById('tf-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyToBounds(t.line.getBounds(), { padding: [60, 60], duration: 0.8 });
    setTimeout(() => t.marker.openPopup(), 900);
  },

  // ซูมไปยังเส้นทางถนน (เรียกจาก VehicleTrackPanel — สภาพการจราจร)
  focusSegment(segId) {
    const line = this.segmentLines && this.segmentLines[segId];
    if (!line) return;
    document.getElementById('tf-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyToBounds(line.getBounds(), { padding: [80, 80], duration: 0.8 });
    setTimeout(() => line.openPopup(), 900);
  },

  // ซูมไปยังกล้อง (เรียกจาก CctvWall)
  focusCam(camId) {
    const m = this.camMarkers && this.camMarkers[camId];
    if (!m) return;
    document.getElementById('tf-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyTo(m.getLatLng(), 17, { duration: 0.8 });
    setTimeout(() => m.openPopup(), 900);
  },

  // ซูมไปยังพิกัด (เช่นเหตุการณ์)
  focus(lat, lng, zoom = 17) {
    if (!this.map || lat == null) return;
    document.getElementById('tf-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }
};
