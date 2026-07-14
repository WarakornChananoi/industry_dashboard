// แบนเนอร์แจ้งเตือน + KPI บริหารจัดการจราจร
// แบนเนอร์: การแจ้งเตือนบัญชีเฝ้าระวังจาก LPR + สรุปสถานการณ์/การสั่งการจาก AI
const TrafficKpiPanel = {
  init(data) {
    this.data = data;
    this.renderBanner();
    this.renderKpis();
  },

  renderBanner() {
    const w = this.data.trafficops.watchlistAlert;
    const s = this.data.trafficops.summary;
    const C = CONFIG.COLORS;
    document.getElementById('traffic-banner').innerHTML = `
      <div class="card border-l-2 p-3.5 flex flex-col md:flex-row gap-3" style="border-left-color:${C.crit}">
        <div class="flex gap-2.5 items-start md:flex-1">
          <svg class="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="${C.crit}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 8.5 15 5l1 3.8-13 3.5Z"/><path d="M8.6 11.2 8 14h8l-.7-4.6"/><path d="M12 14v4M8 21h8"/>
            <circle cx="18.5" cy="7" r="1" fill="${C.crit}"/>
          </svg>
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-0.5">
              <span class="text-xs font-semibold text-ink">${Utils.esc(w.title)}</span>
              <span class="badge badge-crit">บัญชีเฝ้าระวัง</span>
              <span class="text-[10px] text-muted">ตรวจพบ ${Utils.timeHM(w.issuedAt)} น.</span>
            </div>
            <p class="text-[11px] text-ink2 leading-relaxed">${Utils.esc(w.text)}</p>
          </div>
        </div>
        <div class="md:w-[460px] shrink-0 rounded-lg bg-surface2 border border-line/10 p-2.5 flex gap-2.5 items-start">
          <svg class="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="${C.s3}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c1.9.6 3 2.1 3 4a4 4 0 0 1-1 2.6A4 4 0 0 1 16 20a4 4 0 0 1-4 2 4 4 0 0 1-4-2 4 4 0 0 1-2-7.4A4 4 0 0 1 5 10c0-1.9 1.1-3.4 3-4a4 4 0 0 1 4-4Z"/>
          </svg>
          <p class="text-[11px] text-ink2 leading-relaxed flex-1">
            <b class="text-ink">AI ประเมิน:</b> ${Utils.esc(s.headline)}
          </p>
          <!-- แนวโน้มปริมาณรถขาเข้าประตู 1 (จาก sensor จริง) -->
          <div class="shrink-0 w-[104px] hidden sm:block">
            <div class="h-[34px]">${Spark.bars(this.gateSensor().hourlyVolume, C.s1)}</div>
            <div class="text-[9px] text-muted text-center mt-0.5">ปริมาณรถ ${this.gateSensor().id} · 12 ชม.</div>
          </div>
        </div>
      </div>`;
  },

  // sensor ขาเข้าประตู 1 — ใช้เป็นชุดข้อมูลอ้างอิงของแบนเนอร์/KPI
  gateSensor() {
    return this.data.trafficsensors.sensors.find(s => s.id === 'TS-01');
  },

  renderKpis() {
    const s = this.data.trafficops.summary;
    const C = CONFIG.COLORS;
    const gate = this.gateSensor();
    const labels = this.data.trafficsensors.hourlyLabels;
    // สีดัชนีติดขัดตามระดับ (0-3 คล่องตัว / 3-5 ชะลอ / 5-7 หนาแน่น / >7 ติดขัดหนัก)
    const ciColor = s.congestionIndex >= 7 ? C.crit
      : s.congestionIndex >= 5 ? C.serious
      : s.congestionIndex >= 3 ? C.warn : C.good;

    // delta จากชุดข้อมูลจริงของ sensor ประตู 1 (ค่าล่าสุดเทียบชั่วโมงก่อน)
    const spd = gate.hourlySpeed;
    const spdDelta = (spd[spd.length - 1] - spd[spd.length - 2]) / spd[spd.length - 2] * 100;
    const vol = gate.hourlyVolume;
    const volPeakIdx = vol.indexOf(Math.max(...vol));
    // ชุดข้อมูลจำลองประกอบ (LPR รายชั่วโมง / เหตุการณ์ราย 7 วัน)
    const lprHourly = [5.2, 3.8, 2.6, 2.1, 2.4, 3.6, 6.8, 10.4, 13.8, 15.5, 15.1, 14.2];
    const events7d = [1, 2, 1, 3, 2, 4, s.incidentsOpen];

    // เรียงตามความสำคัญ: แถวแรก = การ์ดใหญ่ 2 ใบ (ดัชนีติดขัด + รถในพื้นที่), แถวถัดไป = การ์ดเล็ก 4 ใบ
    const tiles = [
      {
        big: true, span: 'col-span-2',
        label: 'ดัชนีการติดขัด', value: s.congestionIndex.toFixed(1),
        unit: `/${s.congestionIndexMax}`, color: ciColor,
        delta: Spark.delta(14, 'จากชั่วโมงก่อน', 'bad'),
        sub: 'ชั่วโมงเร่งด่วนเช้า · ขาเข้าประตู 1 และคิวประตู 3 หนาแน่น',
        chart: Spark.gauge(s.congestionIndex / s.congestionIndexMax * 100, ciColor),
        chartClass: 'w-[118px] h-[64px]'
      },
      {
        big: true, span: 'col-span-2',
        label: 'รถในพื้นที่ขณะนี้', value: Utils.num(s.vehiclesInAreaNow), unit: 'คัน', color: C.s2,
        delta: Spark.delta(9.4, 'จากชั่วโมงก่อน'),
        sub: `เข้า-ออก 24 ชม. ${Utils.compact(s.vehiclesIn24h)} คัน · ปริมาณรถรายชั่วโมง ${gate.id} →`,
        chart: Spark.bars(vol, C.s2),
        chip: `พีค: ${labels[volPeakIdx]}`
      },
      {
        label: 'ความเร็วเฉลี่ยทั้งเขต', value: s.avgSpeedKmh, unit: 'กม./ชม.', color: C.s1,
        delta: Spark.delta(spdDelta, 'จากชั่วโมงก่อน', spdDelta >= 0 ? 'good' : 'bad'),
        sub: `ความเร็วรายชั่วโมง ${gate.id} →`,
        chart: Spark.line(spd, C.s1)
      },
      {
        label: 'LPR อ่านป้าย 24 ชม.', value: Utils.compact(s.lprReads24h), unit: 'ป้าย', color: C.s5,
        delta: Spark.delta(6.2, 'จากวานนี้', 'good'),
        sub: `ตรงบัญชีเฝ้าระวัง ${s.watchlistHits24h} คัน`,
        chart: Spark.dots(lprHourly, C.s5)
      },
      {
        label: 'เหตุการณ์เปิดอยู่', value: s.incidentsOpen, unit: 'เหตุการณ์', color: C.serious,
        delta: Spark.delta(-25, 'จากวานนี้', 'good'),
        sub: 'อุบัติเหตุ · ติดขัด · ฝ่าฝืน',
        chart: Spark.bars(events7d, C.serious, { highlight: events7d.length - 1 }),
        chip: '7 วัน'
      },
      {
        label: 'อุปกรณ์ออนไลน์',
        value: `${s.camerasOnline + s.sensorsOnline}/${s.camerasTotal + s.sensorsTotal}`, color: C.good,
        delta: Spark.delta(0, 'พร้อมใช้งานทั้งหมด', 'good'),
        sub: `กล้อง ${s.camerasOnline}/${s.camerasTotal} · sensor ${s.sensorsOnline}/${s.sensorsTotal}`,
        chart: Spark.gauge(
          (s.camerasOnline + s.sensorsOnline) / (s.camerasTotal + s.sensorsTotal) * 100, C.good),
        chartClass: 'w-[84px] h-[46px]'
      }
    ];

    document.getElementById('traffic-kpis').innerHTML = tiles.map(t => Spark.tile(t)).join('');
  }
};
