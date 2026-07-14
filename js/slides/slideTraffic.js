// ===== สไลด์ 3: Smart Traffic — ศูนย์จราจรอัจฉริยะ (แผนที่กลาง แผงข้อมูลขนาบสองข้าง) =====
(async function () {
  Slide.fitStage();
  Slide.initNav(2, 'traffic.html');

  let data;
  try {
    data = await DataService.loadAllTraffic();
  } catch (err) {
    document.getElementById('slide-header').innerHTML =
      `<div class="text-crit text-sm">โหลดข้อมูลไม่สำเร็จ: ${Utils.esc(err.message)} — ต้องเปิดผ่าน local server</div>`;
    return;
  }

  const C = CONFIG.COLORS;
  const { cctv, trafficsensors, vehicles, trafficops } = data;
  const sum = trafficops.summary;

  // ---------- หัวสไลด์ ----------
  document.getElementById('slide-header').innerHTML = Slide.header({
    icon: 'truck', color: C.s5,
    title: 'Smart Traffic', tag: 'ศูนย์จราจรอัจฉริยะ',
    sub: 'AI CCTV / LPR · Sensor จราจร · GPS ติดตามยานพาหนะ · ควบคุมสัญญาณไฟอัตโนมัติ · เขตอุตสาหกรรมบางกะดี',
    right: Slide.chip(`กล้อง AI ออนไลน์ ${sum.camerasOnline}/${sum.camerasTotal}`, C.good)
      + Slide.chip('13 ก.ค. 2569 · 09:30 น.')
  });

  // ---------- ซ้าย: ดัชนีการติดขัด + ตัวเลขหลัก ----------
  const miniStat = (label, value, unit) => `
    <div class="slide-inset p-2.5">
      <div class="text-[11px] text-muted leading-tight">${label}</div>
      <div class="flex items-baseline gap-1 mt-1">
        <span class="text-[22px] font-bold leading-none tabular-nums">${value}</span>
        <span class="text-[11px] text-muted">${unit}</span>
      </div>
    </div>`;
  document.getElementById('congestion-card').innerHTML = `
    ${Slide.head('ดัชนีการติดขัดของเขต', 'ชั่วโมงเร่งด่วนเช้า · คำนวณจาก sensor + กล้อง AI ทุกจุด', '', C.warn)}
    <div class="w-[188px] h-[116px] mx-auto mt-1">
      ${SlideCharts.gauge(sum.congestionIndex, sum.congestionIndexMax, C.warn,
        { label: `จากเต็ม ${sum.congestionIndexMax} · หนาแน่น` })}
    </div>
    <div class="grid grid-cols-2 gap-2 mt-2.5">
      ${miniStat('ความเร็วเฉลี่ยทั้งเขต', sum.avgSpeedKmh, 'กม./ชม.')}
      ${miniStat('รถในพื้นที่ขณะนี้', Utils.num(sum.vehiclesInAreaNow), 'คัน')}
      ${miniStat('รถเข้า–ออก 24 ชม.', Utils.num(sum.vehiclesIn24h), 'คัน')}
      ${miniStat('LPR อ่านป้าย 24 ชม.', Utils.num(sum.lprReads24h), 'ครั้ง')}
    </div>`;

  // ---------- ซ้าย: ปริมาณจราจรรายชั่วโมง (จุดหนาแน่นสุด TS-01) ----------
  const ts = trafficsensors.sensors.find(s => s.id === 'TS-01');
  const ratioColor = r => r >= 0.85 ? C.crit : r >= 0.65 ? C.serious : r >= 0.45 ? C.warn : C.good;
  document.getElementById('volume-card').innerHTML = `
    ${Slide.head(`ปริมาณจราจร — ${ts.name}`,
      `${ts.typeLabel} · ความจุ ${Utils.num(ts.capacityPerHr)} คัน/ชม.`, '', C.s1)}
    <div class="flex-1 min-h-0 mt-2">
      ${SlideCharts.bars({
        w: 410, h: 178,
        labels: trafficsensors.hourlyLabels,
        values: ts.hourlyVolume,
        colorFn: v => ratioColor(v / ts.capacityPerHr),
        capacity: ts.capacityPerHr, capacityLabel: 'ความจุ',
        labelStep: 2
      })}
    </div>
    <div class="text-[11px] text-muted mt-1">สีแท่ง = สัดส่วนต่อความจุ (เขียว→เหลือง→ส้ม→แดง) · ชั่วโมงล่าสุด ${Utils.num(ts.volumePerHr)} คัน/ชม.</div>`;

  // ---------- ซ้าย: LOS รายช่วงถนน ----------
  document.getElementById('los-card').innerHTML = `
    ${Slide.head('ระดับการให้บริการรายช่วงถนน (LOS)', 'ความเร็วจริงเทียบความเร็วอิสระ 60 กม./ชม.', '', C.s2)}
    <div class="flex-1 flex flex-col justify-center gap-2 mt-1.5">
      ${trafficsensors.roadSegments.map(seg => {
        const meta = CONFIG.LOS[seg.los];
        return `
        <div>
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <span class="text-[12px] text-ink truncate">${seg.name}</span>
            <span class="text-[11px] font-medium shrink-0" style="color:${meta.textColor || meta.color}">
              ${meta.label}${seg.delayMin ? ` · ล่าช้า +${seg.delayMin} นาที` : ''}</span>
          </div>
          <div class="meter" style="height:7px">
            <span style="width:${Math.min(100, seg.speedKmh / 60 * 100).toFixed(0)}%;background:${meta.color}"></span>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // ---------- ขวา: เหตุการณ์จราจรที่เปิดอยู่ ----------
  // แสดงเฉพาะเหตุการณ์ที่เกี่ยวกับการจราจร — ตัดข้อมูลรถหาย/รถในบัญชีเฝ้าระวังออก
  const openEv = trafficops.events.filter(e =>
    e.status !== 'resolved' && e.type !== 'บัญชีเฝ้าระวัง');
  document.getElementById('incident-card').innerHTML = `
    ${Slide.head('เหตุการณ์จราจรที่ระบบตรวจพบ',
      `เปิดอยู่ ${openEv.length} รายการ · ตรวจจับอัตโนมัติจาก AI CCTV / Sensor / GPS`, '', C.serious)}
    <div class="flex-1 flex flex-col justify-start gap-3 mt-2">
      ${openEv.map(e => {
        const meta = CONFIG.SEVERITY[e.severity];
        return `
        <div class="slide-inset p-3.5 border-l-2" style="border-left-color:${meta.color}">
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <div class="text-[13px] font-semibold leading-snug min-w-0">${e.title}</div>
            ${Utils.badge(meta)}
          </div>
          <div class="text-[11.5px] text-muted leading-snug">${e.detail}</div>
          <div class="text-[10.5px] text-muted mt-1.5">${Utils.timeHM(e.time)} น. · ${e.type}</div>
        </div>`;
      }).join('')}
    </div>`;

  // ---------- ขวา: AI ปรับแผนสัญญาณไฟ ----------
  const planStatus = {
    active: { label: 'กำลังใช้งาน', badge: 'badge-warn' },
    done: { label: 'ปรับแล้ว', badge: 'badge-good' },
    pending: { label: 'คงแผนเดิม', badge: 'badge-info' }
  };
  document.getElementById('signal-card').innerHTML = `
    ${Slide.head('AI ปรับแผนสัญญาณไฟ', 'ข้อเสนอจากโมเดลเรียนรู้รูปแบบจราจร', '', C.s3)}
    <div class="flex flex-col gap-2 mt-2.5">
      ${trafficops.signalPlans.map(p => `
        <div class="slide-inset px-3 py-2.5 flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[12px] font-medium truncate">${p.intersection}</div>
            <div class="text-[11px] text-muted truncate mt-0.5">${p.recommendation}</div>
          </div>
          ${p.expectedImprovementPct
            ? `<span class="text-[16px] font-bold shrink-0 tabular-nums" style="color:${C.good}">−${p.expectedImprovementPct}%</span>`
            : ''}
          <span class="badge ${planStatus[p.status].badge} shrink-0">${planStatus[p.status].label}</span>
        </div>`).join('')}
    </div>`;

  // ---------- แผนที่จราจร (กลาง) ----------
  const map = Slide.staticMap('slide-map');
  const pts = [];

  // ช่วงถนนระบายสีตาม LOS — คลิกดูความเร็ว/ความล่าช้า
  trafficsensors.roadSegments.forEach(seg => {
    const meta = CONFIG.LOS[seg.los];
    Slide.popup(
      L.polyline(seg.path, {
        color: meta.color, weight: 7, opacity: 0.9, lineCap: 'round'
      }).addTo(map), `
      <div class="popup-title">${seg.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(meta)}</div>
      ${Slide.kv('ความเร็วเฉลี่ย', seg.speedKmh + ' กม./ชม.')}
      ${Slide.kv('ความล่าช้า', seg.delayMin ? '+' + seg.delayMin + ' นาที' : 'ไม่มี')}`);
    seg.path.forEach(p => pts.push(p));
  });

  // popup ข้อมูลรถที่ติดตาม (ใช้ทั้งกับเส้นทางและหมุดปลายทาง)
  const vhPopup = v => `
    <div class="popup-title">${v.plate} ${v.province} · ${v.type}</div>
    <div style="margin-bottom:6px">${Utils.badge(CONFIG.VEHICLE_STATUS[v.status])}
      <span style="color:var(--muted)"> ติดตามผ่าน ${v.source === 'gps' ? 'GPS' : 'LPR ข้ามกล้อง'}</span></div>
    ${Slide.kv('ความเร็วล่าสุด', v.speedKmh + ' กม./ชม. · ' + v.heading)}
    ${v.origin !== '—' ? Slide.kv('เส้นทาง', v.origin + ' → ' + v.destination) : ''}
    ${v.detections ? Slide.kv('ตรวจพบผ่านกล้อง',
      v.detections.map(d => d.camId).join(' → ')) : ''}
    <div style="margin-top:6px;color:${v.status === 'alert' ? 'var(--crit)' : 'var(--muted)'}">${v.note}</div>`;

  // เส้นทางรถที่ติดตามผ่าน GPS (VH-01 รถบรรทุกวัตถุดิบ — อยู่ในเส้นทางที่กำหนด)
  const vh1 = vehicles.vehicles.find(v => v.id === 'VH-01');
  Slide.popup(L.polyline(vh1.track.map(t => [t.lat, t.lng]),
    { color: C.s5, weight: 3, opacity: 0.9 }).addTo(map), vhPopup(vh1));
  const last1 = vh1.track[vh1.track.length - 1];
  Slide.popup(Slide.dotMarker(map, last1.lat, last1.lng, C.s5, 7), vhPopup(vh1));

  // sensor จราจร (สีตามสถานะ) — คลิกดูปริมาณ/ความเร็ว/occupancy
  trafficsensors.sensors.forEach(s => {
    const m = Slide.dotMarker(map, s.lat, s.lng, CONFIG.STATUS[s.status].color, 7,
      s.status === 'critical');
    if (s.status === 'critical') Slide.label(m, `${s.id} · คิวรถบรรทุกประตู 3`);
    Slide.popup(m, `
      <div class="popup-title">${s.id} · ${s.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.LOS[s.los])}
        <span style="color:var(--muted)"> ${s.typeLabel}</span></div>
      ${Slide.kv('ปริมาณรถ', Utils.num(s.volumePerHr) + ' / ' + Utils.num(s.capacityPerHr) + ' คัน/ชม.')}
      ${Slide.kv('ความเร็วเฉลี่ย', s.avgSpeedKmh + ' กม./ชม.')}
      ${Slide.kv('Occupancy', s.occupancyPct + '%')}
      <div style="color:var(--muted);margin-top:6px">${s.road} · ทิศ${s.direction} · อัปเดต ${Utils.timeHM(s.lastUpdate)} น.</div>`);
    pts.push([s.lat, s.lng]);
  });

  // กล้อง AI CCTV / LPR — คลิกดูภาพสดจากกล้อง (วิดีโอ) + สถิติ AI
  // (?open=CAM-xx เปิด popup กล้องนั้นอัตโนมัติ สำหรับเตรียมฉากนำเสนอ)
  const openCam = new URLSearchParams(location.search).get('open');
  const camType = { ai_lpr: 'AI CCTV + LPR', ai_cctv: 'AI CCTV', lpr: 'LPR' };
  cctv.cameras.forEach(cam => {
    const m = Slide.dotMarker(map, cam.lat, cam.lng, C.s1, 6);
    if (cam.id === openCam) setTimeout(() => m.openPopup(), 500);
    Slide.popup(m, `
      <div class="popup-title">${cam.id} · ${cam.name}</div>
      <video src="${cam.media}" autoplay muted loop playsinline
        style="width:250px;border-radius:8px;margin:6px 0;background:#000"
        onloadeddata="this.currentTime = Math.min(2, this.duration / 4)"></video>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.STATUS[cam.status])}
        <span style="color:var(--muted)"> ${camType[cam.type] || cam.type}</span></div>
      ${Slide.kv('ปริมาณรถ', Utils.num(cam.vehiclesPerHr) + ' คัน/ชม.')}
      ${cam.lprReadsPerHr ? Slide.kv('LPR อ่านป้าย',
        Utils.num(cam.lprReadsPerHr) + ' ครั้ง/ชม. (แม่นยำ ' + (cam.lprAccuracy * 100).toFixed(1) + '%)') : ''}
      ${Slide.kv('AI ที่ทำงาน', cam.aiFeatures.slice(0, 2).join(' · '))}`);
    pts.push([cam.lat, cam.lng]);
  });

  map.fitBounds(L.latLngBounds(pts).pad(0.13));

  document.getElementById('map-title').innerHTML = `
    <div class="text-[14px] font-semibold leading-tight">แผนที่จราจรเรียลไทม์</div>
    <div class="text-[11.5px] text-muted mt-0.5 max-w-[420px]">${sum.headline}</div>
    <div class="text-[10.5px] text-muted mt-0.5">คลิกหมุดกล้องเพื่อดูภาพสด CCTV · คลิกเส้นถนน/หมุดดูรายละเอียด</div>`;
  document.getElementById('map-stats').innerHTML = `
    <div class="flex items-center gap-4">
      <div class="text-center">
        <div class="text-[20px] font-bold leading-none tabular-nums" style="color:${C.good}">${sum.camerasOnline}/${sum.camerasTotal}</div>
        <div class="text-[10.5px] text-muted mt-1">กล้อง AI</div>
      </div>
      <div class="w-px h-8" style="background:var(--grid)"></div>
      <div class="text-center">
        <div class="text-[20px] font-bold leading-none tabular-nums" style="color:${C.good}">${sum.sensorsOnline}/${sum.sensorsTotal}</div>
        <div class="text-[10.5px] text-muted mt-1">Sensor</div>
      </div>
      <div class="w-px h-8" style="background:var(--grid)"></div>
      <div class="text-center">
        <div class="text-[20px] font-bold leading-none tabular-nums">${sum.incidentsOpen}</div>
        <div class="text-[10.5px] text-muted mt-1">เหตุเปิดอยู่</div>
      </div>
    </div>`;
  document.getElementById('map-legend').innerHTML = Slide.legend([
    { color: CONFIG.LOS.free.color, label: 'ถนนคล่องตัว' },
    { color: CONFIG.LOS.busy.color, label: 'ชะลอตัว' },
    { color: CONFIG.LOS.heavy.color, label: 'หนาแน่น' },
    { color: CONFIG.LOS.jam.color, label: 'ติดขัดหนัก' },
    { color: C.s1, label: 'กล้อง AI CCTV / LPR' },
    { color: C.s5, label: 'รถติดตาม GPS' }
  ]);

  // ให้ Leaflet คำนวณขนาดใหม่หลัง layout นิ่ง (stage ถูก scale ด้วย transform)
  setTimeout(() => map.invalidateSize(), 120);
})();
