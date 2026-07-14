// ปริมาณจราจรรายชั่วโมงจาก Sensor: กราฟแท่งเทียบความจุถนน + ตารางสถานะ sensor
// สีแท่งบอกสภาพจราจร ณ ชั่วโมงนั้น (เทียบอัตราส่วนปริมาณ/ความจุ) — เกณฑ์เดียวกับ LOS
const TrafficFlowPanel = {
  chart: null,

  // จัดระดับสภาพจราจรจากอัตราส่วนปริมาณรถต่อความจุถนน
  losFromRatio(ratio) {
    if (ratio >= 0.9) return CONFIG.LOS.jam;
    if (ratio >= 0.7) return CONFIG.LOS.heavy;
    if (ratio >= 0.45) return CONFIG.LOS.busy;
    return CONFIG.LOS.free;
  },

  init(data) {
    this.data = data;
    const sensors = data.trafficsensors.sensors;

    const sel = document.getElementById('tfl-sensor');
    const keep = this.currentId || sensors.reduce((m, s) =>
      s.volumePerHr / s.capacityPerHr > m.volumePerHr / m.capacityPerHr ? s : m).id;
    sel.innerHTML = sensors.map(s =>
      `<option value="${s.id}" ${s.id === keep ? 'selected' : ''}>${s.id} · ${Utils.esc(s.name)}</option>`).join('');
    sel.onchange = () => {
      this.currentId = sel.value;
      this.renderSensor(sel.value);
    };
    this.currentId = keep;

    this.renderSensor(keep);
    this.renderTable();
    this.renderSummary();
  },

  // สรุปภาพรวมจราจรทั้งเขตจาก sensor ทุกตัว (เติมท้ายการ์ดให้ข้อมูลครบและสมดุลกับการ์ดข้างเคียง)
  renderSummary() {
    const sensors = this.data.trafficsensors.sensors;
    const C = CONFIG.COLORS;
    const totalVol = sensors.reduce((s, x) => s + x.volumePerHr, 0);
    const avgSpeed = Math.round(sensors.reduce((s, x) => s + x.avgSpeedKmh, 0) / sensors.length);
    const congested = sensors.filter(x => x.los === 'jam' || x.los === 'heavy').length;
    const tiles = [
      { label: 'ปริมาณรวมทุกจุด', value: Utils.num(totalVol), unit: 'คัน/ชม.', color: C.s1 },
      { label: 'ความเร็วเฉลี่ยรวม', value: avgSpeed, unit: 'กม./ชม.', color: C.s2 },
      { label: 'จุดหนาแน่น/ติดขัด', value: `${congested}/${sensors.length}`, unit: 'จุด', color: congested > 0 ? C.serious : C.good }
    ];
    document.getElementById('tfl-summary').innerHTML = tiles.map(t => `
      <div class="rounded-lg bg-surface2 border border-line/10 p-2 text-center">
        <div class="text-base font-semibold tabular-nums leading-tight" style="color:${t.color}">${t.value}</div>
        <div class="text-[9px] text-muted">${t.unit}</div>
        <div class="text-[10px] font-medium text-ink leading-tight mt-0.5">${t.label}</div>
      </div>`).join('');
  },

  renderSensor(id) {
    const s = this.data.trafficsensors.sensors.find(x => x.id === id);
    const labels = this.data.trafficsensors.hourlyLabels;
    const C = CONFIG.COLORS;
    const meta = CONFIG.LOS[s.los];

    document.getElementById('tfl-sub').innerHTML =
      `${Utils.esc(s.road)} (${s.direction}) · ขณะนี้ <b style="color:${meta.textColor || meta.color}">${meta.label}</b>
       ${Utils.num(s.volumePerHr)} คัน/ชม. · เส้นประ = ความจุถนน ${Utils.num(s.capacityPerHr)} คัน/ชม.`;

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('tfl-chart'), {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'ปริมาณรถ (คัน/ชม.)',
            data: s.hourlyVolume,
            backgroundColor: s.hourlyVolume.map(v => this.losFromRatio(v / s.capacityPerHr).color + 'd9'),
            borderRadius: 4,
            borderSkipped: 'bottom',
            maxBarThickness: 26
          },
          {
            type: 'line',
            label: 'ความจุถนน',
            data: labels.map(() => s.capacityPerHr),
            borderColor: C.crit,
            borderWidth: 1.5,
            borderDash: [6, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ctx.datasetIndex === 0
                ? ` ${Utils.num(ctx.parsed.y)} คัน/ชม. (${this.losFromRatio(ctx.parsed.y / s.capacityPerHr).label})`
                : ` ความจุถนน ${Utils.num(ctx.parsed.y)} คัน/ชม.`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: C.grid },
            title: { display: true, text: 'คัน/ชม.', font: { size: 10 } }
          }
        }
      }
    });
  },

  // ตาราง sensor ทุกตัว — คลิกเพื่อซูมตำแหน่งบนแผนที่
  renderTable() {
    const wrap = document.getElementById('tfl-table');
    wrap.innerHTML = this.data.trafficsensors.sensors.map(s => {
      const meta = CONFIG.LOS[s.los];
      return `
        <div class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-surface2 border border-line/10 cursor-pointer hover:border-line/25 transition-colors"
             data-lat="${s.lat}" data-lng="${s.lng}">
          <span class="dot shrink-0" style="background:${meta.color}"></span>
          <div class="flex-1 min-w-0">
            <div class="text-[11.5px] font-medium text-ink truncate">${s.id} · ${Utils.esc(s.name)}</div>
            <div class="text-[10px] text-muted">${s.typeLabel} · ${Utils.num(s.volumePerHr)} คัน/ชม. ·
              ${s.avgSpeedKmh} กม./ชม. · occ ${s.occupancyPct}%</div>
          </div>
          <span class="badge ${meta.badge}">${meta.label}</span>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-lat]').forEach(el =>
      el.addEventListener('click', () => TrafficMap.focus(+el.dataset.lat, +el.dataset.lng)));
  }
};
