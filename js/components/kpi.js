// แถว KPI ภาพรวมของทั้งเขตอุตสาหกรรม — ตัวเลขใหญ่ + delta เทียบช่วงก่อน + mini chart (Spark)
const KpiComponent = {
  init(data) {
    const grid = document.getElementById('kpi-grid');
    const C = CONFIG.COLORS;

    // --- คำนวณค่าจากข้อมูลจำลอง ---
    const usageToday = data.buildings.buildings.reduce((s, b) => s + b.usage.todayM3, 0);

    const wqiSensors = data.sensors.sensors.filter(s => s.wqi != null);
    const avgWqi = Math.round(wqiSensors.reduce((s, x) => s + x.wqi, 0) / wqiSensors.length);

    const treatment = data.scada.waterTreatment;
    const prodPct = Math.round(treatment.productionTodayM3 / treatment.capacityM3PerDay * 100);

    const allPumps = data.scada.pumpStations.flatMap(st => st.pumps);
    const running = allPumps.filter(p => p.status === 'running').length;
    const faults = allPumps.filter(p => p.status === 'fault').length;

    const risk = CONFIG.RISK[data.predictions.summary.overallRisk];
    const worst = data.predictions.stations.reduce((m, s) => s.riskScore > m.riskScore ? s : m);
    const highStations = data.predictions.stations.filter(s => s.riskLevel === 'high').length;

    const rc = data.buildings.rateConfig;
    const revenue = data.buildings.buildings
      .reduce((s, b) => s + DataService.computeBill(b, rc).total, 0);
    const unpaid = data.buildings.buildings.filter(b => b.billStatus !== 'paid').length;

    // ชุดข้อมูลย่อของ mini chart (จำลองแนวโน้มย้อนหลังให้สอดคล้องกับค่าปัจจุบัน)
    const usageHourly = [30, 26, 22, 20, 24, 38, 64, 92, 118, 132, 120, usageToday % 100 + 60];
    const prodDaily = [14.6, 15.2, 15.0, 16.1, 16.8, 17.6, treatment.productionTodayM3 / 1000];
    const wqiDaily = [79, 81, 83, 81, 85, 86, avgWqi];
    const pumpsHourly = [3, 3, 4, 4, 3, 4, 4, 5, 6, 5, 5, running];
    const billMonthly = [0.82, 0.86, 0.9, 0.94, 0.99, revenue / 1e6];
    // ระดับน้ำสถานีเสี่ยงสุด: ค่าจริงย้อนหลัง + คาดการณ์ 4 ชม.แรก
    const wlSeries = worst.pastLevels.concat(worst.forecastLevels.slice(0, 4));

    // เรียงตามความสำคัญ: แถวแรก = การ์ดใหญ่ 2 ใบ (ความปลอดภัย + ตัวชี้วัดหลัก), แถวถัดไป = การ์ดเล็ก 4 ใบ
    const tiles = [
      {
        big: true, span: 'col-span-2',
        label: 'ความเสี่ยงน้ำท่วม 24 ชม. (AI)',
        value: risk.label, small: true, color: risk.textColor || risk.color,
        delta: Spark.delta(11.3, 'ระดับน้ำเพิ่มขึ้นใน 6 ชม.', 'bad'),
        sub: highStations > 0 ? `${highStations} จุดเสี่ยงสูง · ระดับน้ำ ${worst.stationId} กำลังเพิ่ม`
          : 'ไม่มีจุดเสี่ยงสูง',
        chart: Spark.line(wlSeries, risk.color), chip: `${worst.stationId} จริง+คาดการณ์`
      },
      {
        big: true, span: 'col-span-2',
        label: 'ปริมาณใช้น้ำวันนี้ (ทุกอาคาร)',
        value: Utils.num(usageToday), unit: 'ลบ.ม.',
        delta: Spark.delta(5.1, 'จากเมื่อวาน'),
        sub: `${data.buildings.buildings.length} อาคาร · มิเตอร์อัจฉริยะ`,
        chart: Spark.bars(usageHourly, C.s1), chip: 'พีค: 10:00'
      },
      {
        label: 'ผลิตน้ำประปาวันนี้',
        value: Utils.compact(treatment.productionTodayM3), unit: 'ลบ.ม.',
        delta: Spark.delta(3.2, 'จากเมื่อวาน', 'good'),
        sub: `${prodPct}% ของกำลังผลิต`,
        chart: Spark.line(prodDaily, C.s1)
      },
      {
        label: 'ดัชนีคุณภาพน้ำเฉลี่ย (WQI)',
        value: avgWqi, unit: '/100',
        delta: Spark.delta((avgWqi - wqiDaily[5]) / wqiDaily[5] * 100, 'จากเมื่อวาน',
          avgWqi >= wqiDaily[5] ? 'good' : 'bad'),
        sub: avgWqi >= 80 ? 'อยู่ในเกณฑ์ดี' : 'ต่ำกว่าเกณฑ์ดี',
        chart: Spark.line(wqiDaily, C.s2)
      },
      {
        label: 'เครื่องสูบน้ำทำงาน',
        value: `${running}/${allPumps.length}`, unit: 'เครื่อง',
        color: faults > 0 ? C.crit : undefined,
        delta: faults > 0
          ? `<span class="text-[10px] font-medium" style="color:${C.crit}">⚠ ขัดข้อง ${faults} เครื่อง</span>`
          : Spark.delta(0, 'ไม่มีเครื่องขัดข้อง', 'good'),
        sub: 'เดินเครื่องรายชั่วโมง (12 ชม.)',
        chart: Spark.dots(pumpsHourly, C.s5)
      },
      {
        label: 'ยอดบิลรอบล่าสุด (ทั้งเขต)',
        value: Utils.baht(revenue / 1e6, 2) + 'M',
        delta: Spark.delta(2.8, 'จากรอบก่อน', 'good'),
        sub: unpaid > 0 ? `ยังไม่ชำระ ${unpaid} ราย` : 'ชำระครบทุกราย',
        chart: Spark.bars(billMonthly, C.s5, { highlight: billMonthly.length - 1 }),
        chip: '6 รอบบิล'
      }
    ];

    grid.innerHTML = tiles.map(t => Spark.tile(t)).join('');
  }
};
