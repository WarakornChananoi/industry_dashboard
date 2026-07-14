// ===== สไลด์ 2: Smart Flood Alert — GIS เฝ้าระวังน้ำท่วม (แผนที่คอลัมน์ขวา) =====
(async function () {
  Slide.fitStage();
  Slide.initNav(1, 'map.html');

  let data;
  try {
    data = await DataService.loadAllGis();
  } catch (err) {
    document.getElementById('slide-header').innerHTML =
      `<div class="text-crit text-sm">โหลดข้อมูลไม่สำเร็จ: ${Utils.esc(err.message)} — ต้องเปิดผ่าน local server</div>`;
    return;
  }

  const C = CONFIG.COLORS;
  const { sensors, predictions, buildings, rainfall, weather, floodzones } = data;
  const fz = floodzones;

  // ---------- หัวสไลด์ ----------
  const warning = weather.warnings[0];
  document.getElementById('slide-header').innerHTML = Slide.header({
    icon: 'map', color: C.serious,
    title: 'Smart Flood Alert', tag: 'GIS เฝ้าระวังและคาดการณ์น้ำท่วม',
    sub: 'เรดาร์ฝน · สถานีวัดฝน IoT · ระดับน้ำเรียลไทม์ · FloodGuard AI + แบบจำลองภูมิประเทศ (DEM)',
    right: `<span class="badge badge-serious">${Slide.icon('alert', 12)} ${warning.title}</span>`
      + Slide.chip('13 ก.ค. 2569 · 09:30 น.')
  });

  // ---------- แบนเนอร์สถานการณ์ ----------
  document.getElementById('alert-banner').innerHTML = `
    <div class="rounded-[18px] border px-5 py-3 flex items-center gap-4"
         style="border-color:${C.serious}66;background:${C.serious}17">
      <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style="background:${C.serious}26;color:${C.serious}">${Slide.icon('alert', 20)}</span>
      <div class="min-w-0">
        <div class="text-[14.5px] font-semibold leading-snug">${fz.summary.headline}</div>
        <div class="text-[11.5px] text-muted mt-0.5">${fz.model} · ขอบเขตคาดการณ์ ${fz.horizonHours} ชม. ข้างหน้า</div>
      </div>
    </div>`;

  // ---------- แถวตัวเลขสถานการณ์ (สไตล์กระชับ ต่างจากสไลด์ 1) ----------
  const rainMax = Math.max(...rainfall.gauges.map(g => g.rain24hMm));
  const highZones = fz.zones.filter(z => z.riskLevel === 'high').length;
  const stat = (icon, color, value, unit, label) => `
    <div class="slide-card p-3.5 flex items-center gap-3">
      <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style="background:${color}1f;color:${color}">${Slide.icon(icon, 19)}</span>
      <div class="min-w-0">
        <div class="flex items-baseline gap-1">
          <span class="text-[28px] font-bold leading-none tabular-nums">${value}</span>
          <span class="text-[12px] text-muted">${unit}</span>
        </div>
        <div class="text-[11.5px] text-muted mt-1 leading-tight">${label}</div>
      </div>
    </div>`;
  document.getElementById('stat-row').innerHTML =
    stat('map', C.crit, fz.summary.zonesTotal, 'โซน', `พื้นที่เสี่ยง (สูง ${highZones} โซน)`)
    + stat('factory', C.serious, fz.summary.factoriesAffected, 'แห่ง', 'โรงงานในแนวเสี่ยง')
    + stat('users', C.s5, Utils.num(fz.summary.employeesAffected), 'คน', 'พนักงานที่ได้รับผลกระทบ')
    + stat('rain', C.s1, rainMax.toFixed(1), 'มม.', 'ฝนสะสม 24 ชม. สูงสุด');

  // ---------- การ์ดโซนเสี่ยง ----------
  const riskColor = z => CONFIG.RISK[z.riskLevel].color;
  document.getElementById('zone-card').innerHTML = `
    ${Slide.head('พื้นที่เสี่ยงน้ำท่วมขังคาดการณ์ 12 ชม. ข้างหน้า',
      'ความน่าจะเป็น · ความลึกคาดการณ์ · เวลาถึงเกณฑ์ (ETA) · โรงงานที่ต้องแจ้งเตือน',
      Slide.chip('FloodGuard LSTM v2.3'), C.serious)}
    <div class="flex-1 flex flex-col justify-center gap-3 mt-3">
      ${fz.zones.map(z => `
        <div class="slide-inset p-3 flex items-center gap-4">
          <div class="w-[96px] shrink-0 text-center">
            <div class="text-[30px] font-bold leading-none tabular-nums" style="color:${riskColor(z)}">
              ${Math.round(z.probability * 100)}<span class="text-[15px]">%</span>
            </div>
            <div class="text-[11px] text-muted mt-1">ความน่าจะเป็น</div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[13.5px] font-semibold truncate">${z.id} · ${z.name}</span>
              ${Utils.badge(CONFIG.RISK[z.riskLevel])}
            </div>
            <div class="meter mt-1.5" style="height:7px">
              <span style="width:${(z.probability * 100).toFixed(0)}%;background:${riskColor(z)}"></span>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-[11.5px] text-ink2">
              <span>ลึกสุด <b class="tabular-nums">~${z.expectedDepthM.toFixed(2)} ม.</b></span>
              <span>ถึงเกณฑ์ใน <b class="tabular-nums">${z.etaHours} ชม.</b></span>
              <span>พื้นที่ <b class="tabular-nums">${z.areaRai} ไร่</b></span>
              <span>โรงงาน <b class="tabular-nums">${z.affectedBuildings.length}</b> แห่ง</span>
            </div>
          </div>
        </div>`).join('')}
    </div>`;

  // ---------- การ์ดฝนสะสม (สถานีวัดฝน IoT) ----------
  const rain3Max = Math.max(...rainfall.gauges.map(g => g.rain3hMm));
  document.getElementById('rain-card').innerHTML = `
    ${Slide.head('ฝนสะสม 3 ชม. รายสถานี', 'สถานีวัดฝน IoT ในเขต 4 จุด', '', C.s1)}
    <div class="flex-1 flex flex-col justify-center gap-2 mt-1.5">
      ${rainfall.gauges.map(g => {
        const warn = g.status === 'warning';
        return `
        <div>
          <div class="flex items-baseline justify-between gap-2 mb-0.5">
            <span class="text-[12px] ${warn ? 'font-semibold' : 'text-ink2'}">${g.id} · ${g.name.replace('สถานีวัดฝน ', '')}</span>
            <span class="text-[12px] font-semibold tabular-nums" style="color:${warn ? 'var(--warn-text)' : 'var(--ink)'}">
              ${g.rain3hMm.toFixed(1)} มม.</span>
          </div>
          <div class="meter" style="height:7px">
            <span style="width:${(g.rain3hMm / rain3Max * 100).toFixed(0)}%;background:${warn ? C.warn : C.s1}"></span>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="text-[10.5px] text-muted mt-1">เกณฑ์เฝ้าระวัง 25 มม./3 ชม. — RG-02 และ RG-03 เกินเกณฑ์</div>`;

  // ---------- การ์ดไทม์ไลน์การตอบสนองอัตโนมัติ ----------
  const flowIcon = { iot: 'radio', rain: 'rain', ai: 'cpu', alert: 'alert', scada: 'pump' };
  const flowColor = { done: C.good, active: C.warn, pending: C.muted };
  const steps = fz.responseFlow.slice(0, 5);
  document.getElementById('flow-card').innerHTML = `
    ${Slide.head('การทำงานเชื่อมโยงอัตโนมัติ', 'IoT ตรวจจับ → AI ประเมิน → แจ้งเตือน → สั่งการ SCADA', '', C.s2)}
    <div class="flex-1 flex flex-col justify-center gap-1 mt-2">
      ${steps.map((s, i) => `
        <div class="flex items-start gap-3">
          <div class="flex flex-col items-center shrink-0">
            <span class="w-7 h-7 rounded-full flex items-center justify-center"
                  style="background:${flowColor[s.status]}1f;color:${flowColor[s.status]}">
              ${Slide.icon(flowIcon[s.source] || 'bolt', 13)}</span>
            ${i < steps.length - 1 ? '<span class="w-px h-3.5" style="background:var(--grid)"></span>' : ''}
          </div>
          <div class="min-w-0 pb-0.5">
            <div class="text-[12px] leading-snug ${s.status === 'active' ? 'font-semibold' : 'text-ink2'}">
              <span class="text-muted">${s.time ? Utils.timeHM(s.time) : 'รอ'} · ${s.sourceLabel}</span> — ${s.title}
            </div>
          </div>
        </div>`).join('')}
    </div>`;

  // ---------- แผนที่ GIS (ขวา) ----------
  const map = Slide.staticMap('slide-map');
  const pts = [];

  // โซนคาดการณ์น้ำท่วม (polygon) + ป้ายชื่อกลางโซน — คลิกดูรายละเอียด/คำแนะนำ
  const bldName = id => {
    const b = buildings.buildings.find(x => x.id === id);
    return b ? `${id} ${b.company}` : id;
  };
  fz.zones.forEach(z => {
    const color = riskColor(z);
    const poly = L.polygon(z.polygon, {
      color, weight: 2, fillColor: color, fillOpacity: 0.22, dashArray: '6 4'
    }).addTo(map);
    poly.bindTooltip(`${z.id} · ${Math.round(z.probability * 100)}%`, {
      permanent: true, direction: 'center', className: 'zone-label'
    });
    Slide.popup(poly, `
      <div class="popup-title">${z.id} · ${z.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.RISK[z.riskLevel])}</div>
      ${Slide.kv('ความน่าจะเป็น', Math.round(z.probability * 100) + '%')}
      ${Slide.kv('ความลึกคาดการณ์', '~' + z.expectedDepthM.toFixed(2) + ' ม.')}
      ${Slide.kv('ถึงเกณฑ์ใน', z.etaHours + ' ชม.')}
      ${Slide.kv('พื้นที่', z.areaRai + ' ไร่')}
      ${z.affectedBuildings.length ? `<div style="margin-top:6px;color:var(--muted)">โรงงานที่ต้องแจ้งเตือน</div>
        <div>${z.affectedBuildings.map(bldName).join('<br>')}</div>` : ''}
      <div style="margin-top:6px;color:var(--muted)">ข้อมูลประกอบ</div><div>${z.basis}</div>
      <div style="margin-top:6px;color:var(--warn-text)">→ ${z.recommendation}</div>`, 300);
    z.polygon.forEach(p => pts.push(p));
  });

  // แนวคลองระบายน้ำหลัก
  Slide.popup(
    L.polyline(fz.canal.path, { color: C.s1, weight: 4, opacity: 0.75 }).addTo(map),
    `<div class="popup-title">${fz.canal.name}</div>`);
  fz.canal.path.forEach(p => pts.push(p));

  // สถานีวัดระดับน้ำ (คลิกดูค่าจริง+คาดการณ์) + สถานีวัดฝน + โรงงานที่ได้รับผลกระทบ
  sensors.sensors.filter(s => s.type === 'water_level').forEach(s => {
    const color = CONFIG.STATUS[s.status].color;
    const m = Slide.dotMarker(map, s.lat, s.lng, color, 8, s.status === 'critical');
    if (s.status !== 'normal')
      Slide.label(m, `${s.id} · ${s.readings.waterLevel.toFixed(2)} ม.`, 'bottom', 10);
    const pred = predictions.stations.find(p => p.stationId === s.id);
    Slide.popup(m, `
      <div class="popup-title">${s.id} · ${s.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.STATUS[s.status])}
        ${pred ? ' ' + Utils.badge(CONFIG.RISK[pred.riskLevel]) : ''}</div>
      ${Slide.kv('ระดับน้ำปัจจุบัน', s.readings.waterLevel.toFixed(2) + ' ม.')}
      ${Slide.kv('เกณฑ์น้ำท่วม', s.readings.floodThreshold.toFixed(2) + ' ม.')}
      ${Slide.kv('อัตราการไหล', s.readings.flowRate + ' ลบ.ม./วินาที')}
      ${pred ? Slide.kv('พีคคาดการณ์ (AI)', pred.peakLevel.toFixed(2) + ' ม. (' + pred.peakAt + ')') : ''}
      <div style="color:var(--muted);margin-top:6px">อัปเดต ${Utils.timeHM(s.lastUpdate)} น.</div>`);
    pts.push([s.lat, s.lng]);
  });
  rainfall.gauges.forEach(g => {
    const m = Slide.dotMarker(map, g.lat, g.lng, g.status === 'warning' ? C.warn : C.s5, 6);
    Slide.popup(m, `
      <div class="popup-title">${g.id} · ${g.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.STATUS[g.status])}</div>
      ${Slide.kv('ฝน 1 ชม.', g.rain1hMm.toFixed(1) + ' มม.')}
      ${Slide.kv('ฝนสะสม 3 ชม.', g.rain3hMm.toFixed(1) + ' มม.')}
      ${Slide.kv('ฝนสะสม 24 ชม.', g.rain24hMm.toFixed(1) + ' มม.')}
      ${Slide.kv('แบตเตอรี่', g.batteryPct + '%')}
      <div style="color:var(--muted);margin-top:6px">อัปเดต ${Utils.timeHM(g.lastUpdate)} น.</div>`);
  });
  const affected = new Set(fz.zones.flatMap(z => z.affectedBuildings));
  buildings.buildings.filter(b => affected.has(b.id)).forEach(b => {
    const zone = fz.zones.find(z => z.affectedBuildings.includes(b.id));
    const m = Slide.dotMarker(map, b.lat, b.lng, C.serious, 6);
    Slide.popup(m, `
      <div class="popup-title">${b.id} · ${b.company}</div>
      <div style="color:var(--muted);margin-bottom:6px">${b.type} · โซน ${b.zone}</div>
      ${Slide.kv('อยู่ในโซนเสี่ยง', zone.id)}
      ${Slide.kv('น้ำลึกคาดการณ์', '~' + zone.expectedDepthM.toFixed(2) + ' ม. ใน ' + zone.etaHours + ' ชม.')}
      <div style="margin-top:6px;color:var(--warn-text)">แจ้งเตือน SMS/LINE แล้ว — เริ่มย้ายสินค้าชั้นล่าง</div>`);
  });

  map.fitBounds(L.latLngBounds(pts).pad(0.1));

  document.getElementById('map-title').innerHTML = `
    <div class="text-[14px] font-semibold leading-tight">แผนที่ GIS โซนน้ำท่วมคาดการณ์</div>
    <div class="text-[11.5px] text-muted mt-0.5">FloodGuard AI + DEM · ${fz.horizonHours} ชม. ข้างหน้า</div>
    <div class="text-[10.5px] text-muted mt-0.5">คลิกโซน/หมุดเพื่อดูรายละเอียด · ลาก/ซูมแผนที่ได้</div>`;
  document.getElementById('map-legend').innerHTML = Slide.legend([
    { color: C.crit, label: 'โซนเสี่ยงสูง' },
    { color: C.warn, label: 'โซนเสี่ยงปานกลาง' },
    { color: C.good, label: 'โซนเสี่ยงต่ำ' },
    { color: C.s1, label: 'คลองระบายน้ำหลัก / สถานีระดับน้ำ' },
    { color: C.s5, label: 'สถานีวัดฝน IoT' },
    { color: C.serious, label: 'โรงงานที่ได้รับผลกระทบ' }
  ]);

  // แถบระดับน้ำเทียบเกณฑ์ (ล่างแผนที่)
  document.getElementById('map-strip').innerHTML = `
    <div class="grid grid-cols-3 gap-6">
      ${predictions.stations.map(st => {
        const pct = Math.min(100, st.currentLevel / st.floodThreshold * 100);
        const color = riskColor({ riskLevel: st.riskLevel });
        return `
        <div>
          <div class="flex items-baseline justify-between gap-2 mb-1.5">
            <span class="text-[12px] font-medium">${st.stationId}</span>
            <span class="text-[12px] tabular-nums text-ink2">
              <b style="color:${color}">${st.currentLevel.toFixed(2)}</b> / ${st.floodThreshold.toFixed(2)} ม.
            </span>
          </div>
          <div class="meter" style="height:8px">
            <span style="width:${pct.toFixed(0)}%;background:${color}"></span>
          </div>
          <div class="text-[10.5px] text-muted mt-1">พีคคาดการณ์ ${st.peakLevel.toFixed(2)} ม. (${st.peakAt})</div>
        </div>`;
      }).join('')}
    </div>`;

  // ให้ Leaflet คำนวณขนาดใหม่หลัง layout นิ่ง (stage ถูก scale ด้วย transform)
  setTimeout(() => map.invalidateSize(), 120);
})();
