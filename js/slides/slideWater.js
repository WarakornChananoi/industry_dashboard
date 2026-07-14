// ===== สไลด์ 1: Smart Water — ภาพรวมระบบบริหารจัดการน้ำ (แผนที่คอลัมน์ซ้าย) =====
(async function () {
  Slide.fitStage();
  Slide.initNav(0, 'index.html');

  let data;
  try {
    data = await DataService.loadAll();
  } catch (err) {
    document.getElementById('slide-header').innerHTML =
      `<div class="text-crit text-sm">โหลดข้อมูลไม่สำเร็จ: ${Utils.esc(err.message)} — ต้องเปิดผ่าน local server</div>`;
    return;
  }

  const C = CONFIG.COLORS;
  const { sensors, predictions, scada, anomalies, buildings } = data;

  // ---------- หัวสไลด์ ----------
  const riskMeta = CONFIG.RISK[predictions.summary.overallRisk];
  document.getElementById('slide-header').innerHTML = Slide.header({
    icon: 'droplet', color: C.s1,
    title: 'Smart Water', tag: 'ระบบบริหารจัดการน้ำอัจฉริยะ',
    sub: 'ภาพรวมโครงข่ายน้ำส่วนกลาง · IoT เซนเซอร์ · SCADA · AI คาดการณ์ · เขตอุตสาหกรรมบางกะดี',
    right: Utils.badge(riskMeta) + Slide.chip('13 ก.ค. 2569 · 09:30 น.')
  });

  // ---------- แผนที่ (ซ้าย): เซนเซอร์ + สถานีสูบ + โรงงาน (คลิกหมุดดูรายละเอียด) ----------
  const map = Slide.staticMap('slide-map');
  const pts = [];

  buildings.buildings.forEach(b => {
    pts.push([b.lat, b.lng]);
    const warn = b.id === 'B-07'; // AI ตรวจพบใช้น้ำกลางคืนผิดปกติ
    const m = Slide.dotMarker(map, b.lat, b.lng, warn ? C.warn : C.s2, 6);
    if (warn) Slide.label(m, 'B-07 ใช้น้ำผิดปกติ');
    Slide.popup(m, `
      <div class="popup-title">${b.id} · ${b.company}</div>
      <div style="color:var(--muted);margin-bottom:6px">${b.type} · โซน ${b.zone} · มิเตอร์ ${b.meterId}</div>
      ${Slide.kv('ใช้น้ำวันนี้', Utils.num(b.usage.todayM3) + ' ลบ.ม.')}
      ${Slide.kv('สะสมเดือนนี้', Utils.num(b.usage.monthToDateM3) + ' ลบ.ม.')}
      ${Slide.kv('เดือนก่อน (' + buildings.billingPeriodLabel + ')', Utils.num(b.usage.lastMonthM3) + ' ลบ.ม.')}
      <div style="margin-top:6px">${Utils.badge(CONFIG.BILL_STATUS[b.billStatus])}</div>
      ${b.note ? `<div style="margin-top:6px;color:var(--warn-text)">⚠ ${b.note}</div>` : ''}`);
  });

  scada.pumpStations.forEach(ps => {
    pts.push([ps.lat, ps.lng]);
    const fault = ps.status === 'fault';
    const m = Slide.dotMarker(map, ps.lat, ps.lng, fault ? C.crit : C.s5, 9, fault);
    if (fault) Slide.label(m, `${ps.id} ปั๊มขัดข้อง`, 'bottom', 10);
    Slide.popup(m, `
      <div class="popup-title">${ps.id} · ${ps.name}</div>
      <div style="color:var(--muted);margin-bottom:6px">${ps.role} · โหมด ${ps.mode === 'auto' ? 'อัตโนมัติ' : 'แมนวล'}</div>
      ${ps.pumps.map(p => Slide.kv(
        `<span class="dot" style="background:${CONFIG.STATUS[p.status].color};width:7px;height:7px;margin-right:4px"></span>${p.id} · ${CONFIG.STATUS[p.status].label}`,
        p.flowRate ? Utils.num(p.flowRate) + ' ลบ.ม./ชม.' : '—')).join('')}
      ${ps.pumps.filter(p => p.faultDesc).map(p =>
        `<div style="margin-top:6px;color:var(--crit)">⚠ ${p.id}: ${p.faultDesc}</div>`).join('')}`);
  });

  sensors.sensors.forEach(s => {
    pts.push([s.lat, s.lng]);
    const color = CONFIG.STATUS[s.status].color;
    const m = Slide.dotMarker(map, s.lat, s.lng, color, 8, s.status === 'critical');
    if (s.status === 'critical')
      Slide.label(m, `${s.id} · ${s.readings.waterLevel.toFixed(2)} ม.`);
    const r = s.readings;
    Slide.popup(m, `
      <div class="popup-title">${s.id} · ${s.name}</div>
      <div style="margin-bottom:6px">${Utils.badge(CONFIG.STATUS[s.status])}
        <span style="color:var(--muted)"> ${CONFIG.SENSOR_TYPE[s.type]}</span></div>
      ${s.wqi != null ? Slide.kv('ดัชนีคุณภาพน้ำ (WQI)', s.wqi + ' /100') : ''}
      ${r.ph != null ? Slide.kv('pH / DO', r.ph + ' / ' + r.do + ' mg/L') : ''}
      ${r.turbidity != null ? Slide.kv('ความขุ่น', r.turbidity + ' NTU') : ''}
      ${r.waterLevel != null && r.floodThreshold ? Slide.kv('ระดับน้ำ / เกณฑ์',
        r.waterLevel.toFixed(2) + ' / ' + r.floodThreshold.toFixed(2) + ' ม.') : ''}
      ${r.waterLevel != null && r.tankCapacity ? Slide.kv('ระดับถัง',
        r.waterLevel.toFixed(1) + ' / ' + r.tankCapacity.toFixed(1) + ' ม.') : ''}
      ${r.flowRate != null ? Slide.kv('อัตราการไหล', r.flowRate + ' ลบ.ม./วินาที') : ''}
      <div style="color:var(--muted);margin-top:6px">อัปเดต ${Utils.timeHM(s.lastUpdate)} น.</div>`);
  });

  map.fitBounds(L.latLngBounds(pts).pad(0.12));

  document.getElementById('map-title').innerHTML = `
    <div class="text-[14px] font-semibold leading-tight">โครงข่ายน้ำและอุปกรณ์ IoT</div>
    <div class="text-[11.5px] text-muted mt-0.5">
      เซนเซอร์ ${sensors.sensors.length} จุด · สถานีสูบ ${scada.pumpStations.length} แห่ง · โรงงาน ${buildings.buildings.length} แห่ง
    </div>
    <div class="text-[10.5px] text-muted mt-0.5">คลิกหมุดเพื่อดูรายละเอียด · ลาก/ซูมแผนที่ได้</div>`;
  document.getElementById('map-legend').innerHTML = Slide.legend([
    { color: C.good, label: 'เซนเซอร์ ปกติ' },
    { color: C.warn, label: 'เซนเซอร์ เฝ้าระวัง' },
    { color: C.crit, label: 'วิกฤต / ขัดข้อง' },
    { color: C.s5, label: 'สถานีสูบน้ำ (SCADA)' },
    { color: C.s2, label: 'โรงงาน (มิเตอร์น้ำ)' }
  ]);

  // ---------- แถว KPI (4 ใบ) ----------
  const blds = buildings.buildings;
  const todayM3 = blds.reduce((s, b) => s + b.usage.todayM3, 0);
  const mtdM3 = blds.reduce((s, b) => s + b.usage.monthToDateM3, 0);
  const dailyTotal = blds[0].usage.daily.map((_, i) =>
    blds.reduce((s, b) => s + b.usage.daily[i], 0));
  const wt = scada.waterTreatment;
  const prodPct = Math.round(wt.productionTodayM3 / wt.capacityM3PerDay * 100);
  const open = anomalies.events.filter(e => e.status !== 'resolved');
  const openCrit = open.filter(e => e.severity === 'critical').length;
  const openWarn = open.filter(e => e.severity === 'warning').length;

  document.getElementById('kpi-row').innerHTML = [
    Slide.stat({
      icon: 'alert', color: C.warn, label: 'ความเสี่ยงน้ำท่วม 24 ชม.',
      value: riskMeta.label.replace('เสี่ยง', ''), valueColor: 'var(--warn-text)', small: true,
      sub: `ฝนคาดการณ์ ${predictions.rainfall.next24hMm} มม. · โอกาสฝน ${Math.round(predictions.rainfall.probability * 100)}% · FloodGuard AI`
    }),
    Slide.stat({
      icon: 'droplet', color: C.s1, label: 'การใช้น้ำวันนี้',
      value: Utils.num(todayM3), unit: 'ลบ.ม.',
      sub: `สะสมเดือนนี้ ${Utils.num(mtdM3)} ลบ.ม. · ${blds.length} โรงงาน`,
      chart: Spark.bars(dailyTotal, C.s1), chartClass: 'w-[110px] h-[52px]'
    }),
    Slide.stat({
      icon: 'gauge', color: C.s2, label: 'ผลิตน้ำประปาวันนี้',
      value: Utils.num(wt.productionTodayM3), unit: 'ลบ.ม.',
      sub: `${prodPct}% ของกำลังผลิต ${Utils.num(wt.capacityM3PerDay)} ลบ.ม./วัน`,
      chart: Spark.gauge(prodPct, C.s2, { w: 100, h: 56 }),
      chartClass: 'w-[100px] h-[56px]'
    }),
    Slide.stat({
      icon: 'cpu', color: C.crit, label: 'แจ้งเตือน AI ที่เปิดอยู่',
      value: open.length, unit: 'รายการ', valueColor: C.crit,
      sub: `วิกฤต ${openCrit} · เฝ้าระวัง ${openWarn} · ${anomalies.model.split(' ')[0]}`,
      chart: Spark.bars([openCrit, openWarn], null, { colors: [C.crit, C.warn] }),
      chartClass: 'w-[52px] h-[46px]'
    })
  ].join('');

  // ---------- การ์ดคาดการณ์ระดับน้ำ (AI) — จุดวิกฤต WL-103 ----------
  const st = predictions.stations.find(s => s.riskLevel === 'high') || predictions.stations[2];
  const labels = [...st.pastLabels, ...st.forecastLabels];
  const forecast = [st.currentLevel, ...st.forecastLevels]; // ต่อเส้นจากค่าจริงจุดสุดท้าย

  document.getElementById('pred-card').innerHTML = `
    ${Slide.head(
      `AI คาดการณ์ระดับน้ำ 12 ชม. ข้างหน้า — ${st.stationId} ${st.name}`,
      predictions.summary.headline,
      Utils.badge(CONFIG.RISK[st.riskLevel]), C.s3)}
    <div class="flex gap-6 flex-1 min-h-0 mt-4">
      <div class="flex-1 min-w-0 flex flex-col">
        <div class="flex items-center gap-4 mb-1 text-[12px] text-ink2">
          <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.s1}"></span>ระดับน้ำจริง</span>
          <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.s3}"></span>คาดการณ์ AI</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-4 border-t-2 border-dashed" style="border-color:${C.crit}"></span>เกณฑ์น้ำท่วม ${st.floodThreshold.toFixed(2)} ม.</span>
        </div>
        <div class="flex-1 min-h-0">
          ${SlideCharts.line({
            w: 660, h: 250, labels,
            series: [
              { data: st.pastLevels, color: C.s1, area: true },
              { data: forecast, start: st.pastLabels.length - 1, color: C.s3, dash: '7 6', endLabel: st.forecastLevels[st.forecastLevels.length - 1].toFixed(2) + ' ม.' }
            ],
            threshold: { value: st.floodThreshold, label: `เกณฑ์ ${st.floodThreshold.toFixed(2)} ม.` },
            yDigits: 1, xTicks: 8
          })}
        </div>
      </div>
      <div class="w-[300px] shrink-0 flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="slide-inset p-3.5">
            <div class="slide-kicker">Risk Score</div>
            <div class="text-[30px] font-bold leading-none mt-1.5" style="color:${C.crit}">
              ${Math.round(st.riskScore * 100)}<span class="text-[14px] text-muted font-normal">/100</span>
            </div>
          </div>
          <div class="slide-inset p-3.5">
            <div class="slide-kicker">จุดสูงสุดคาดการณ์</div>
            <div class="text-[30px] font-bold leading-none mt-1.5">
              ${st.peakLevel.toFixed(2)}<span class="text-[14px] text-muted font-normal"> ม. (${st.peakAt})</span>
            </div>
          </div>
        </div>
        <div class="slide-inset p-3.5 flex-1">
          <div class="flex items-center gap-2 text-[12.5px] font-semibold mb-1.5" style="color:${C.s3}">
            ${Slide.icon('bolt', 14)} คำแนะนำจากระบบ
          </div>
          <p class="text-[13px] text-ink2 leading-relaxed">${predictions.summary.recommendation}</p>
        </div>
      </div>
    </div>`;

  // ---------- การ์ด SCADA: สถานะปั๊ม + การผลิต ----------
  const pumps = scada.pumpStations.flatMap(ps => ps.pumps);
  const cnt = k => pumps.filter(p => p.status === k).length;
  const running = cnt('running'), standby = cnt('standby'), fault = cnt('fault');

  document.getElementById('scada-card').innerHTML = `
    ${Slide.head('SCADA — สถานีสูบและปั๊มน้ำ',
      `PLC ${CONFIG.STATUS[scada.plc.status].label} · I/O ${Utils.num(scada.plc.ioPoints)} จุด · สื่อสาร ${(scada.plc.commHealth * 100).toFixed(1)}%`,
      '', C.s5)}
    <div class="flex items-center gap-6 flex-1 mt-3 min-h-0">
      ${SlideCharts.donut([
        { value: running, color: C.good },
        { value: standby, color: C.muted },
        { value: fault, color: C.crit }
      ], { size: 148, thick: 20, centerValue: pumps.length, centerLabel: 'ปั๊มทั้งหมด' })}
      <div class="flex-1 min-w-0 space-y-2.5">
        <div class="flex items-center gap-4 text-[12px] text-ink2">
          <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.good}"></span>ทำงาน ${running}</span>
          <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.muted}"></span>สแตนด์บาย ${standby}</span>
          <span class="inline-flex items-center gap-1.5"><span class="dot" style="background:${C.crit}"></span>ขัดข้อง ${fault}</span>
        </div>
        ${scada.pumpStations.map(ps => {
          const flow = ps.pumps.reduce((s, p) => s + p.flowRate, 0);
          const meta = CONFIG.STATUS[ps.status === 'fault' ? 'fault' : 'normal'];
          return `
          <div class="flex items-center justify-between gap-2 slide-inset px-3 py-2">
            <div class="min-w-0">
              <span class="text-[12.5px] font-medium">${ps.id}</span>
              <span class="text-[11.5px] text-muted"> · ${ps.name}</span>
            </div>
            <div class="flex items-center gap-2.5 shrink-0">
              <span class="text-[12px] tabular-nums text-ink2">${Utils.num(flow)} ลบ.ม./ชม.</span>
              ${Utils.badge(meta)}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // ---------- การ์ด Top 5 ผู้ใช้น้ำ ----------
  const top5 = [...blds].sort((a, b) => b.usage.lastMonthM3 - a.usage.lastMonthM3).slice(0, 5);
  document.getElementById('top-card').innerHTML = `
    ${Slide.head(`Top 5 ผู้ใช้น้ำสูงสุด — ${buildings.billingPeriodLabel}`,
      'ปริมาณการใช้จากมิเตอร์อัจฉริยะ (Meter Billing System)', '', C.s1)}
    <div class="flex-1 flex flex-col justify-center gap-3 mt-3">
      ${SlideCharts.hbars(top5.map(b => ({
        label: b.company.replace('บจก. ', ''),
        value: b.usage.lastMonthM3,
        valueLabel: Utils.num(b.usage.lastMonthM3) + ' ลบ.ม.',
        color: b.id === 'B-07' ? C.warn : C.s1
      })))}
    </div>
    <div class="text-[11px] text-muted mt-2 flex items-center gap-1.5">
      <span class="dot" style="background:${C.warn};width:7px;height:7px"></span>
      ยูเนี่ยนเปเปอร์มิลล์ (B-07) — AI ตรวจพบการใช้น้ำกลางคืนผิดปกติ อาจมีท่อรั่วภายใน
    </div>`;

  // ให้ Leaflet คำนวณขนาดใหม่หลัง layout นิ่ง (stage ถูก scale ด้วย transform)
  setTimeout(() => map.invalidateSize(), 120);
})();
