// สถานีวัดน้ำฝน IoT: สรุปฝนสะสม + กราฟรายชั่วโมง + ตารางทุกสถานี
const RainPanel = {
  chart: null,
  data: null,

  // จัดระดับความแรงฝนตามเกณฑ์ มม./ชม.
  intensityMeta(mmPerHr) {
    const C = CONFIG.COLORS;
    if (mmPerHr > 15) return { label: 'ฝนหนักมาก', color: C.crit, badge: 'badge-crit' };
    if (mmPerHr > 7.5) return { label: 'ฝนหนัก', color: C.serious, badge: 'badge-serious' };
    if (mmPerHr > 2.5) return { label: 'ฝนปานกลาง', color: C.warn, badge: 'badge-warn', textColor: 'var(--warn-text)' };
    if (mmPerHr > 0) return { label: 'ฝนเล็กน้อย', color: C.s1, badge: 'badge-info' };
    return { label: 'ไม่มีฝน', color: C.good, badge: 'badge-good' };
  },
  intensityLabel(mmPerHr) {
    return this.intensityMeta(mmPerHr).label;
  },

  init(data) {
    this.data = data.rainfall;
    document.getElementById('rain-updated').textContent =
      `${this.data.gauges.length} สถานีทั่วเขต · อัปเดต ${Utils.timeHM(this.data.updatedAt)} น.`;

    const select = document.getElementById('rain-gauge-select');
    const prev = select.value; // คงสถานีที่เลือกไว้เมื่อ render ซ้ำ (สลับธีม)
    select.innerHTML = this.data.gauges.map((g, i) =>
      `<option value="${i}">${Utils.esc(g.name)} (${g.id})</option>`).join('');
    // ครั้งแรกเปิดที่สถานีฝนสะสม 24 ชม. มากสุด
    const worst = this.data.gauges.reduce((m, g, i, arr) => g.rain24hMm > arr[m].rain24hMm ? i : m, 0);
    const current = prev !== '' ? +prev : worst;
    select.value = String(current);
    select.onchange = () => this.renderGauge(+select.value);

    this.renderGauge(current);
    this.renderTable();
  },

  renderGauge(idx) {
    const g = this.data.gauges[idx];
    this.renderStats(g);
    this.renderChart(g);
  },

  renderStats(g) {
    const meta = this.intensityMeta(g.rain1hMm);
    const tiles = [
      { label: 'ฝน 1 ชม. ล่าสุด', value: `${g.rain1hMm}`, unit: 'มม.', color: meta.color },
      { label: 'สะสม 3 ชม.', value: `${g.rain3hMm}`, unit: 'มม.', color: CONFIG.COLORS.s1 },
      { label: 'สะสม 24 ชม.', value: `${g.rain24hMm}`, unit: 'มม.', color: CONFIG.COLORS.s1 }
    ];
    document.getElementById('rain-stats').innerHTML = tiles.map(t => `
      <div class="rounded-lg bg-surface2 border border-line/10 p-2.5 text-center">
        <div class="text-[10px] text-muted mb-0.5">${t.label}</div>
        <div class="text-lg font-semibold tabular-nums" style="color:${t.color}">${t.value}
          <span class="text-[10px] font-normal text-muted">${t.unit}</span></div>
      </div>`).join('');
  },

  // กราฟแท่งฝนรายชั่วโมง — สีแท่งตามระดับความแรงฝน
  renderChart(g) {
    const colors = g.hourlyMm.map(v => this.intensityMeta(v).color);
    const C = CONFIG.COLORS;
    const cfg = {
      type: 'bar',
      data: {
        labels: g.hourlyLabels,
        datasets: [{
          label: 'ปริมาณฝน (มม./ชม.)',
          data: g.hourlyMm,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: 'bottom',
          maxBarThickness: 26
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)} มม. — ${this.intensityLabel(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            grid: { color: C.grid },
            title: { display: true, text: 'มม./ชม.', color: C.muted, font: { size: 10 } },
            beginAtZero: true
          }
        }
      }
    };
    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('rain-chart'), cfg);
  },

  renderTable() {
    const select = document.getElementById('rain-gauge-select');
    document.getElementById('rain-gauge-table').innerHTML = this.data.gauges.map((g, i) => {
      const meta = this.intensityMeta(g.rain1hMm);
      return `
        <tr data-idx="${i}">
          <td>
            <div class="flex items-center gap-1.5">
              <span class="dot" style="background:${meta.color}"></span>
              <div>
                <div class="font-medium text-ink leading-tight">${Utils.esc(g.name.replace('สถานีวัดฝน ', ''))}</div>
                <div class="text-[10px] text-muted">${g.id} · แบต ${g.batteryPct}%</div>
              </div>
            </div>
          </td>
          <td class="num">${g.rain1hMm.toFixed(1)}</td>
          <td class="num">${g.rain3hMm.toFixed(1)}</td>
          <td class="num">${g.rain24hMm.toFixed(1)}</td>
          <td><span class="badge ${meta.badge}">${meta.label}</span></td>
        </tr>`;
    }).join('');

    // คลิกแถว → สลับกราฟ + ซูมแผนที่ไปที่สถานี
    document.querySelectorAll('#rain-gauge-table tr').forEach(tr => {
      tr.onclick = () => {
        const i = +tr.dataset.idx;
        select.value = String(i);
        this.renderGauge(i);
        const g = this.data.gauges[i];
        GisMap.focus(g.lat, g.lng, 16);
      };
    });
  }
};
