// แผงแจ้งเตือนน้ำท่วม: แบนเนอร์ประกาศเตือนภัย + KPI สถานการณ์ +
// รายการโซนคาดการณ์น้ำท่วม + โรงงานที่ได้รับผลกระทบ (คลิกซูมบนแผนที่)
const FloodAlertPanel = {
  init(data) {
    this.data = data;
    this.renderBanner();
    this.renderKpis();
    this.renderZones();
    this.renderFactories();
    document.getElementById('flood-model').textContent =
      `${data.floodzones.model} · ล่วงหน้า ${data.floodzones.horizonHours} ชม.`;
  },

  // แบนเนอร์: ประกาศกรมอุตุฯ + สรุปสถานการณ์จาก AI
  renderBanner() {
    const w = this.data.weather.warnings[0];
    const s = this.data.floodzones.summary;
    const C = CONFIG.COLORS;
    document.getElementById('flood-banner').innerHTML = `
      <div class="card border-l-2 p-3.5 flex flex-col md:flex-row gap-3" style="border-left-color:${C.serious}">
        <div class="flex gap-2.5 items-start md:flex-1">
          <svg class="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="${C.serious}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>
          </svg>
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-0.5">
              <span class="text-xs font-semibold text-ink">${Utils.esc(w.title)}</span>
              <span class="badge badge-serious">เตือนภัยระดับส้ม</span>
              <span class="text-[10px] text-muted">ออกประกาศ ${Utils.timeHM(w.issuedAt)} น.</span>
            </div>
            <p class="text-[11px] text-ink2 leading-relaxed">${Utils.esc(w.text)}</p>
          </div>
        </div>
        <div class="md:w-[460px] shrink-0 rounded-lg bg-surface2 border border-line/10 p-2.5 flex gap-2.5 items-start">
          <svg class="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="${C.s3}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 3 7v5c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V7Z"/>
          </svg>
          <p class="text-[11px] text-ink2 leading-relaxed flex-1">
            <b class="text-ink">AI ประเมิน:</b> ${Utils.esc(s.headline)}
          </p>
          <!-- แนวโน้มระดับน้ำสถานีเสี่ยงสุด (ค่าจริง+คาดการณ์) -->
          <div class="shrink-0 w-[104px] hidden sm:block">
            <div class="h-[34px]">${this.worstLevelSpark()}</div>
            <div class="text-[9px] text-muted text-center mt-0.5">ระดับน้ำ ${this.worstStation().stationId} · 16 ชม.</div>
          </div>
        </div>
      </div>`;
  },

  worstStation() {
    return this.data.predictions.stations.reduce((m, s) => s.riskScore > m.riskScore ? s : m);
  },

  // sparkline ระดับน้ำของสถานีเสี่ยงสุด: ค่าจริงย้อนหลัง + คาดการณ์
  worstLevelSpark() {
    const st = this.worstStation();
    return Spark.line(st.pastLevels.concat(st.forecastLevels), CONFIG.COLORS.crit);
  },

  // KPI สถานการณ์เฝ้าระวัง 6 ตัว (ตัวเลขใหญ่ + delta + mini chart)
  renderKpis() {
    const d = this.data;
    const fz = d.floodzones;
    const highZones = fz.zones.filter(z => z.riskLevel === 'high').length;
    const worst = this.worstStation();
    const rainMax = d.rainfall.gauges.reduce((m, g) => g.rain24hMm > m.rain24hMm ? g : m);
    const drainPumps = d.scada.pumpStations.find(p => p.id === 'PS-03');
    const running = drainPumps.pumps.filter(p => p.status === 'running');
    const drainFlow = running.reduce((s, p) => s + p.flowRate, 0);
    const C = CONFIG.COLORS;

    // แท่งความน่าจะเป็นรายโซน (สีตามระดับความเสี่ยงของโซนนั้น)
    const zoneProbs = fz.zones.map(z => z.probability);
    const zoneColors = fz.zones.map(z => CONFIG.RISK[z.riskLevel].color);
    // ฝนรายชั่วโมงจริงจากสถานีที่ฝนตกหนักสุด
    const rainPeakIdx = rainMax.hourlyMm.indexOf(Math.max(...rainMax.hourlyMm));
    // แนวโน้มจำนวนโรงงานที่ถูกประกาศแจ้งเตือนสะสม (12 ชม.)
    const affectedTrend = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, fz.summary.factoriesAffected];
    // ฝนคาดการณ์รายชั่วโมงข้างหน้า (จำลองจากยอดรวม 24 ชม.)
    const rainForecast = [2, 3, 5, 8, 12, 10, 7, 9, 6, 4, 2, 1];
    // อัตราพร่องน้ำสะสมหลังสั่งเปิดปั๊มเพิ่ม (จำลอง)
    const drainTrend = [420, 420, 430, 450, 520, 610, 700, 810, 900, 940, 970, drainFlow];

    // เรียงตามความสำคัญ: แถวแรก = การ์ดใหญ่ 2 ใบ (ระดับน้ำวิกฤต + โซนเสี่ยง), แถวถัดไป = การ์ดเล็ก 4 ใบ
    const tiles = [
      {
        big: true, span: 'col-span-2',
        label: `ระดับน้ำวิกฤตสุด (${worst.stationId})`,
        value: `${Math.round(worst.currentLevel / worst.floodThreshold * 100)}%`, color: C.crit,
        delta: Spark.delta(
          (worst.currentLevel - worst.pastLevels[0]) / worst.pastLevels[0] * 100, 'ใน 6 ชม.', 'bad'),
        sub: `${worst.currentLevel}/${worst.floodThreshold} ม. · จริง+คาดการณ์`,
        chart: Spark.line(worst.pastLevels.concat(worst.forecastLevels.slice(0, 6)), C.crit),
        chip: `พีค: ${worst.peakAt || '—'}`
      },
      {
        big: true, span: 'col-span-2',
        label: 'โซนเสี่ยงน้ำท่วม (AI)', value: fz.zones.length, unit: 'โซน', color: C.crit,
        delta: `<span class="text-[10px] font-medium" style="color:${C.crit}">⚠ เสี่ยงสูง ${highZones} โซน</span>`,
        sub: 'ความน่าจะเป็นรายโซน →',
        chart: Spark.bars(zoneProbs, null, { colors: zoneColors }), chartClass: 'w-[120px] h-[56px]'
      },
      {
        label: 'โรงงานได้รับผลกระทบ', value: fz.summary.factoriesAffected, unit: 'แห่ง', color: C.serious,
        delta: Spark.delta(25, 'จาก 4 แห่งเมื่อ 3 ชม.ก่อน', 'bad'),
        sub: `พนักงาน ~${Utils.num(fz.summary.employeesAffected)} คน`,
        chart: Spark.dots(affectedTrend.slice(2), C.serious)
      },
      {
        label: 'ฝนสะสม 24 ชม. สูงสุด', value: rainMax.rain24hMm, unit: 'มม.', color: C.s1,
        delta: Spark.delta(32, 'จากวานนี้', 'bad'),
        sub: `${rainMax.id} · ${RainPanel.intensityLabel(rainMax.rain1hMm)}`,
        chart: Spark.bars(rainMax.hourlyMm, C.s1),
        chip: `พีค: ${rainMax.hourlyLabels[rainPeakIdx]}`
      },
      {
        label: 'ฝนคาดการณ์ 24 ชม.', value: d.predictions.rainfall.next24hMm, unit: 'มม.', color: C.s3,
        delta: Spark.delta(Math.round(d.predictions.rainfall.probability * 100) - 60, 'โอกาสฝนสูงขึ้น', 'bad'),
        sub: `โอกาสฝน ${Math.round(d.predictions.rainfall.probability * 100)}% · รายชั่วโมง →`,
        chart: Spark.line(rainForecast, C.s3)
      },
      {
        label: 'อัตราพร่องน้ำ PS-03', value: Utils.num(drainFlow), unit: 'ลบ.ม./ชม.', color: C.s5,
        delta: Spark.delta(133, 'หลังเปิดปั๊มเพิ่ม', 'good'),
        sub: `ปั๊มเดิน ${running.length}/${drainPumps.pumps.length} ตัว`,
        chart: Spark.line(drainTrend, C.s5)
      }
    ];

    document.getElementById('flood-kpis').innerHTML = tiles.map(t => Spark.tile(t)).join('');
  },

  // การ์ดโซนน้ำท่วม — คลิกเพื่อซูมแผนที่ไปยัง polygon
  renderZones() {
    const wrap = document.getElementById('flood-zone-list');
    wrap.innerHTML = this.data.floodzones.zones.map(z => {
      const meta = CONFIG.RISK[z.riskLevel];
      return `
        <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-3 cursor-pointer hover:border-line/25 transition-colors"
             style="border-left-color:${meta.color}" data-zone="${z.id}">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-xs font-semibold text-ink">${z.id} · ${Utils.esc(z.name.split(' — ')[0])}</span>
            ${Utils.badge(meta)}
          </div>
          <div class="text-[11px] text-ink2 leading-relaxed">${Utils.esc(z.name.split(' — ')[1] || '')}</div>
          <div class="grid grid-cols-3 gap-2 mt-2 text-center">
            <div class="rounded bg-page/60 py-1.5">
              <div class="text-[10px] text-muted">ความน่าจะเป็น</div>
              <div class="text-sm font-semibold tabular-nums" style="color:${meta.color}">${Math.round(z.probability * 100)}%</div>
            </div>
            <div class="rounded bg-page/60 py-1.5">
              <div class="text-[10px] text-muted">น้ำลึกคาดการณ์</div>
              <div class="text-sm font-semibold text-ink tabular-nums">${z.expectedDepthM} ม.</div>
            </div>
            <div class="rounded bg-page/60 py-1.5">
              <div class="text-[10px] text-muted">เริ่มท่วมใน</div>
              <div class="text-sm font-semibold text-ink tabular-nums">~${z.etaHours} ชม.</div>
            </div>
          </div>
          <div class="mt-2 text-[10.5px] text-muted leading-relaxed">
            <b class="text-ink2 font-medium">ปัจจัย:</b> ${Utils.esc(z.basis)}
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-zone]').forEach(el =>
      el.addEventListener('click', () => GisMap.focusZone(el.dataset.zone)));
  },

  // รายชื่อโรงงานที่อยู่ในโซนคาดการณ์ — คลิกเพื่อซูมไปที่อาคาร
  renderFactories() {
    const d = this.data;
    const rows = [];
    d.floodzones.zones.forEach(z => {
      const meta = CONFIG.RISK[z.riskLevel];
      z.affectedBuildings.forEach(id => {
        const b = d.buildings.buildings.find(x => x.id === id);
        if (b) rows.push({ b, z, meta });
      });
    });
    document.getElementById('flood-factory-list').innerHTML = rows.map(({ b, z, meta }) => `
      <div class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-surface2 border border-line/10 cursor-pointer hover:border-line/25 transition-colors"
           data-lat="${b.lat}" data-lng="${b.lng}">
        <span class="dot" style="background:${meta.color}"></span>
        <div class="flex-1 min-w-0">
          <div class="text-[11.5px] font-medium text-ink truncate">${Utils.esc(b.company)}</div>
          <div class="text-[10px] text-muted">${b.id} · ${Utils.esc(b.type)} · โซนคาดการณ์ ${z.id}</div>
        </div>
        <span class="badge ${meta.badge}">${meta.label}</span>
      </div>`).join('') ||
      '<div class="text-[11px] text-muted">— ไม่มีโรงงานในโซนคาดการณ์ —</div>';

    document.querySelectorAll('#flood-factory-list [data-lat]').forEach(el =>
      el.addEventListener('click', () => GisMap.focus(+el.dataset.lat, +el.dataset.lng)));
  }
};
