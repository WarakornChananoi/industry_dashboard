// Meter Billing System — คำนวณและแสดงบิลค่าน้ำตามการใช้งานจริงรายอาคาร
const BillingPanel = {
  chart: null,
  zoneChart: null,
  trendChart: null,
  data: null,

  init(data) {
    this.data = data.buildings;
    const rc = this.data.rateConfig;
    const bills = this.data.buildings.map(b => ({ b, bill: DataService.computeBill(b, rc) }));

    document.getElementById('billing-period').textContent =
      `รอบบิล ${this.data.billingPeriodLabel} · ออกบิล ${new Date(this.data.issueDate).toLocaleDateString('th-TH')} · ครบกำหนด ${new Date(this.data.dueDate).toLocaleDateString('th-TH')} · อัตราค่าน้ำ ${rc.waterRatePerM3} ฿/ลบ.ม. + ค่าบำบัด ${rc.wastewaterRatePerM3} ฿/ลบ.ม. (${rc.wastewaterFactor * 100}% ของปริมาณใช้)`;

    this.renderSummary(bills);
    this.renderStats(bills);
    this.renderChart(bills);
    this.renderZoneChart(bills);
    this.renderTrendChart();
    this.renderTable(bills);
    this.bindModal();
  },

  renderSummary(bills) {
    const totalUsage = bills.reduce((s, x) => s + x.bill.usage, 0);
    const totalAmount = bills.reduce((s, x) => s + x.bill.total, 0);
    const unpaid = bills.filter(x => x.b.billStatus !== 'paid');
    const unpaidAmount = unpaid.reduce((s, x) => s + x.bill.total, 0);

    document.getElementById('billing-summary').innerHTML = `
      <span class="badge badge-info">ใช้น้ำรวม ${Utils.num(totalUsage)} ลบ.ม.</span>
      <span class="badge badge-info">ยอดบิลรวม ${Utils.baht(totalAmount, 0)}</span>
      <span class="badge ${unpaid.length ? 'badge-warn' : 'badge-good'}">
        ยังไม่ชำระ ${unpaid.length} ราย (${Utils.baht(unpaidAmount, 0)})
      </span>`;
  },

  // แถบสรุปการเงิน — แยกองค์ประกอบของรายได้และอัตราการเก็บชำระ
  renderStats(bills) {
    const C = CONFIG.COLORS;
    const sum = key => bills.reduce((s, x) => s + x.bill[key], 0);
    const totalRevenue = sum('total');
    const collected = bills.filter(x => x.b.billStatus === 'paid').reduce((s, x) => s + x.bill.total, 0);
    const collectRate = Math.round(collected / totalRevenue * 100);

    const tiles = [
      { label: 'รายได้รวมรอบบิล', value: Utils.baht(totalRevenue, 0), sub: `เฉลี่ย ${Utils.baht(totalRevenue / bills.length, 0)}/อาคาร`, color: C.s5 },
      { label: 'ค่าน้ำประปา', value: Utils.baht(sum('waterCharge'), 0), sub: `${Math.round(sum('waterCharge') / totalRevenue * 100)}% ของรายได้`, color: C.s1 },
      { label: 'ค่าบำบัดน้ำเสีย', value: Utils.baht(sum('wastewaterCharge'), 0), sub: `${Math.round(sum('wastewaterCharge') / totalRevenue * 100)}% ของรายได้`, color: C.s2 },
      { label: 'ภาษีมูลค่าเพิ่ม 7%', value: Utils.baht(sum('vat'), 0), sub: `+ ค่าบริการ ${Utils.baht(sum('serviceFee'), 0)}`, color: C.s3 },
      { label: 'เก็บชำระแล้ว', value: collectRate + '%', sub: `${Utils.baht(collected, 0)} จาก ${bills.length} ราย`, color: collectRate >= 80 ? C.good : C.warn, subColor: collectRate >= 80 ? null : 'var(--warn-text)' }
    ];

    document.getElementById('billing-stats').innerHTML = tiles.map(t => `
      <div class="rounded-lg bg-surface2 border border-line/10 p-3">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="dot" style="background:${t.color}"></span>
          <span class="text-[11px] text-muted leading-tight">${t.label}</span>
        </div>
        <div class="text-lg font-semibold text-ink">${t.value}</div>
        <div class="text-[11px] mt-0.5" style="color:${t.subColor || '#898781'}">${t.sub}</div>
      </div>
    `).join('');
  },

  renderChart(bills) {
    const sorted = [...bills].sort((a, z) => z.bill.usage - a.bill.usage);
    const C = CONFIG.COLORS;

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('billing-chart'), {
      type: 'bar',
      data: {
        labels: sorted.map(x => x.b.company.replace(/^บจก\.\s*/, '')),
        datasets: [{
          data: sorted.map(x => x.bill.usage),
          backgroundColor: C.s1,
          barThickness: 13,
          borderRadius: 4,
          borderSkipped: 'start'   // ปลายแท่งโค้ง ฐานตรง
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const x = sorted[ctx.dataIndex];
                return [
                  ` ใช้น้ำ ${Utils.num(x.bill.usage)} ลบ.ม.`,
                  ` ยอดบิล ${Utils.baht(x.bill.total, 2)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: C.grid },
            ticks: { callback: v => Utils.compact(v) },
            title: { display: true, text: 'ลบ.ม.', color: C.muted, font: { size: 10 } }
          },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  },

  // โดนัทสัดส่วนการใช้น้ำตามโซนอุตสาหกรรม (A/B/C) — สีตามลำดับ categorical
  renderZoneChart(bills) {
    const C = CONFIG.COLORS;
    const zoneColors = { A: C.s1, B: C.s2, C: C.s3 };

    const byZone = {};
    bills.forEach(({ b, bill }) => {
      byZone[b.zone] = byZone[b.zone] || { usage: 0, count: 0 };
      byZone[b.zone].usage += bill.usage;
      byZone[b.zone].count += 1;
    });
    const zones = Object.keys(byZone).sort();
    const total = zones.reduce((s, z) => s + byZone[z].usage, 0);

    if (this.zoneChart) this.zoneChart.destroy();
    this.zoneChart = new Chart(document.getElementById('billing-zone-chart'), {
      type: 'doughnut',
      data: {
        labels: zones.map(z => 'โซน ' + z),
        datasets: [{
          data: zones.map(z => byZone[z].usage),
          backgroundColor: zones.map(z => zoneColors[z]),
          borderColor: C.surface,
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${Utils.num(ctx.parsed)} ลบ.ม. (${Math.round(ctx.parsed / total * 100)}%)`
            }
          }
        }
      }
    });

    // legend กำกับข้าง (ระบุตัวตนไม่พึ่งสีอย่างเดียว)
    document.getElementById('billing-zone-legend').innerHTML = zones.map(z => {
      const d = byZone[z];
      const pct = Math.round(d.usage / total * 100);
      return `
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-ink2">
            <span class="dot" style="background:${zoneColors[z]}"></span>โซน ${z}
            <span class="text-muted">(${d.count} อาคาร)</span>
          </span>
          <span class="text-ink font-medium tabular-nums">${Utils.num(d.usage)} <span class="text-muted font-normal">· ${pct}%</span></span>
        </div>`;
    }).join('');
  },

  // เส้นแนวโน้มการใช้น้ำรวมของทุกอาคาร 14 วันล่าสุด (ใช้ usage.daily)
  renderTrendChart() {
    const C = CONFIG.COLORS;
    const buildings = this.data.buildings;
    const days = Math.max(...buildings.map(b => b.usage.daily.length));

    const totals = Array(days).fill(0);
    buildings.forEach(b => b.usage.daily.forEach((v, i) => { totals[i] += v; }));

    // ป้ายวันที่ย้อนหลัง 14 วันสิ้นสุดวันนี้
    const labels = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
    }

    const avg = totals.reduce((a, b) => a + b, 0) / days;
    const peak = Math.max(...totals);
    const peakIdx = totals.indexOf(peak);
    document.getElementById('billing-trend-meta').innerHTML =
      `เฉลี่ย <b class="text-ink2">${Utils.num(Math.round(avg))}</b> ลบ.ม./วัน · สูงสุด <b class="text-ink2">${Utils.num(peak)}</b> ลบ.ม. (${labels[peakIdx]})`;

    if (this.trendChart) this.trendChart.destroy();
    this.trendChart = new Chart(document.getElementById('billing-trend-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'การใช้น้ำรวม',
          data: totals,
          borderColor: C.s1,
          backgroundColor: C.s1 + '1a',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: C.s1,
          pointHoverBorderColor: C.surface,
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${Utils.num(ctx.parsed.y)} ลบ.ม.` } }
        },
        scales: {
          x: { grid: { color: C.grid }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            grid: { color: C.grid },
            ticks: { callback: v => Utils.compact(v) },
            title: { display: true, text: 'ลบ.ม./วัน', color: C.muted, font: { size: 10 } },
            beginAtZero: true
          }
        }
      }
    });
  },

  renderTable(bills) {
    const tbody = document.getElementById('billing-table');
    tbody.innerHTML = bills.map(({ b, bill }, i) => {
      const bs = CONFIG.BILL_STATUS[b.billStatus];
      return `
        <tr data-idx="${i}">
          <td>
            <div class="font-medium text-ink">${Utils.esc(b.company)}</div>
            <div class="text-[10px] text-muted">${b.id} · โซน ${b.zone} · ${b.meterId}${b.note ? ' · <span style="color:var(--warn-text)">⚠ พบความผิดปกติ</span>' : ''}</div>
          </td>
          <td>${Utils.esc(b.type)}</td>
          <td class="num">${Utils.num(bill.usage)}</td>
          <td class="num font-medium text-ink">${Utils.num(bill.total, 2)}</td>
          <td>${Utils.badge({ ...bs, color: undefined })}</td>
          <td><button class="bill-btn text-s1 text-[11px] hover:underline whitespace-nowrap" data-idx="${i}">ดูบิล →</button></td>
        </tr>`;
    }).join('');

    // คลิกแถว = ไปยังอาคารบนแผนที่ / ปุ่ม "ดูบิล" = เปิดใบแจ้งค่าน้ำ
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const b = bills[+tr.dataset.idx].b;
        MapComponent.focus(b.lat, b.lng);
      });
    });
    tbody.querySelectorAll('.bill-btn').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        this.openModal(bills[+btn.dataset.idx]);
      });
    });
  },

  openModal({ b, bill }) {
    const bs = CONFIG.BILL_STATUS[b.billStatus];
    document.getElementById('bill-modal-period').textContent =
      `รอบบิล ${this.data.billingPeriodLabel} · มิเตอร์ ${b.meterId} · ครบกำหนด ${new Date(this.data.dueDate).toLocaleDateString('th-TH')}`;

    const row = (label, val, cls = '') =>
      `<div class="flex justify-between py-1.5 ${cls}"><span>${label}</span><span class="tabular-nums">${val}</span></div>`;

    document.getElementById('bill-modal-body').innerHTML = `
      <div class="mb-3">
        <div class="font-semibold text-ink">${Utils.esc(b.company)}</div>
        <div class="text-[11px] text-muted">${b.id} · ${Utils.esc(b.type)} · โซน ${b.zone}</div>
      </div>
      <div class="rounded-lg bg-surface2 border border-line/10 px-3 py-2 text-xs divide-y divide-line/5">
        ${row('ปริมาณการใช้น้ำ', Utils.num(bill.usage) + ' ลบ.ม.')}
        ${row(`ค่าน้ำประปา (${this.data.rateConfig.waterRatePerM3} ฿/ลบ.ม.)`, Utils.baht(bill.waterCharge, 2))}
        ${row(`ค่าบำบัดน้ำเสีย (${this.data.rateConfig.wastewaterFactor * 100}% × ${this.data.rateConfig.wastewaterRatePerM3} ฿)`, Utils.baht(bill.wastewaterCharge, 2))}
        ${row('ค่าบริการรายเดือน', Utils.baht(bill.serviceFee, 2))}
        ${row('ภาษีมูลค่าเพิ่ม 7%', Utils.baht(bill.vat, 2))}
        ${row('<b class="text-ink">ยอดรวมทั้งสิ้น</b>', `<b class="text-ink">${Utils.baht(bill.total, 2)}</b>`, '!border-t !border-line/15 mt-1 pt-2')}
      </div>
      <div class="flex items-center justify-between mt-3">
        <span class="text-[11px] text-muted">สถานะการชำระ</span>
        ${Utils.badge({ ...bs, color: undefined })}
      </div>
      ${b.note ? `<div class="mt-3 text-[11px] rounded-lg border border-warn/40 bg-warn/10 px-3 py-2" style="color:var(--warn-text)">⚠ ${Utils.esc(b.note)}</div>` : ''}`;

    document.getElementById('bill-modal').classList.remove('hidden');
  },

  bindModal() {
    // ใช้ onclick เพื่อไม่ให้ handler ซ้อนเมื่อ render ซ้ำ (สลับธีม)
    const modal = document.getElementById('bill-modal');
    document.getElementById('bill-modal-close').onclick = () => modal.classList.add('hidden');
    modal.onclick = ev => { if (ev.target === modal) modal.classList.add('hidden'); };
  }
};
