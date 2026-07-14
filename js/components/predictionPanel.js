// กราฟคาดการณ์ระดับน้ำล่วงหน้าโดย AI + สรุปความเสี่ยงรายสถานี
const PredictionPanel = {
  chart: null,
  data: null,

  init(data) {
    this.data = data.predictions;
    document.getElementById('prediction-model').textContent =
      `โมเดล ${this.data.model} · ประมวลผลล่าสุด ${Utils.timeHM(this.data.generatedAt)} น.`;

    const select = document.getElementById('prediction-station');
    const prev = select.value; // คงสถานีที่เลือกไว้เมื่อ render ซ้ำ (สลับธีม)
    select.innerHTML = this.data.stations.map((s, i) =>
      `<option value="${i}">${Utils.esc(s.name)} (${s.stationId})</option>`).join('');
    // ครั้งแรกเปิดที่สถานีความเสี่ยงสูงสุด
    const worst = this.data.stations.reduce((m, s, i, arr) => s.riskScore > arr[m].riskScore ? i : m, 0);
    const current = prev !== '' ? +prev : worst;
    select.value = String(current);
    select.onchange = () => this.renderStation(+select.value);

    this.renderHeadline();
    this.renderRain();
    this.renderStation(current);
  },

  renderStation(idx) {
    const st = this.data.stations[idx];
    this.renderRiskCard(st);
    this.renderChart(st);
    this.renderOverview(idx);
  },

  // แถบสรุปภาพรวมสถานการณ์จาก AI (ทั้งเขต) — แสดงเสมอ ไม่ขึ้นกับสถานีที่เลือก
  renderHeadline() {
    const s = this.data.summary;
    const meta = CONFIG.RISK[s.overallRisk];
    document.getElementById('prediction-headline').innerHTML = `
      <div class="rounded-lg bg-surface2 border border-line/10 border-l-2 p-3 flex gap-2.5 items-start"
           style="border-left-color:${meta.color}">
        <svg class="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="${meta.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 3 7v5c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V7Z"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[11px] font-medium text-ink">ประเมินภาพรวมโดย AI</span>
            ${Utils.badge(meta)}
          </div>
          <p class="text-[11px] text-ink2 leading-relaxed">${Utils.esc(s.headline)}</p>
        </div>
      </div>`;
  },

  // หาเวลาที่เส้นคาดการณ์ตัดเกณฑ์วิกฤตครั้งแรก (ETA ถึงระดับน้ำท่วม)
  etaToThreshold(st) {
    for (let i = 0; i < st.forecastLevels.length; i++) {
      if (st.forecastLevels[i] >= st.floodThreshold) {
        return st.forecastLabels[i];
      }
    }
    return null;
  },

  // ตารางสรุปทุกจุดเฝ้าระวัง — คลิกแถวเพื่อสลับกราฟรายสถานี (ไฮไลต์สถานีที่เลือก)
  renderOverview(activeIdx) {
    const tbody = document.getElementById('prediction-stations-table');
    tbody.innerHTML = this.data.stations.map((st, i) => {
      const meta = CONFIG.RISK[st.riskLevel];
      const eta = this.etaToThreshold(st);
      const active = i === activeIdx;
      const etaColor = st.riskLevel === 'high' ? CONFIG.COLORS.crit : 'var(--warn-text)';
      const etaCell = eta
        ? `<span class="font-medium" style="color:${etaColor}">~ ${eta} น.</span>`
        : '<span class="text-muted">ไม่ถึงเกณฑ์ใน 12 ชม.</span>';
      return `
        <tr data-idx="${i}" style="${active ? 'background:rgb(var(--tw-s1) / 0.08)' : ''}">
          <td>
            <div class="flex items-center gap-1.5">
              <span class="dot" style="background:${meta.color}"></span>
              <div>
                <div class="font-medium text-ink leading-tight">${Utils.esc(st.name)}</div>
                <div class="text-[10px] text-muted">${st.stationId} · เกณฑ์วิกฤต ${st.floodThreshold} ม.</div>
              </div>
            </div>
          </td>
          <td class="num">${st.currentLevel.toFixed(2)}</td>
          <td class="num">${st.peakLevel.toFixed(2)} <span class="text-[10px] text-muted">(${st.peakAt})</span></td>
          <td class="whitespace-nowrap">${etaCell}</td>
          <td>${Utils.badge(meta)}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.onclick = () => {
        const i = +tr.dataset.idx;
        document.getElementById('prediction-station').value = String(i);
        this.renderStation(i);
      };
    });
  },

  renderRiskCard(st) {
    const meta = CONFIG.RISK[st.riskLevel];
    const score = Math.round(st.riskScore * 100);
    document.getElementById('prediction-risk').innerHTML = `
      <div class="rounded-lg bg-surface2 border border-line/10 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            ${Utils.badge(meta)}
            <span class="text-xs text-ink2">คะแนนความเสี่ยง <b class="text-ink">${score}%</b></span>
          </div>
          <span class="text-xs text-ink2">คาดการณ์สูงสุด <b class="text-ink">${st.peakLevel} ม.</b> ที่ <b class="text-ink">${st.peakAt}</b> (เกณฑ์ ${st.floodThreshold} ม.)</span>
        </div>
        <div class="meter mt-2"><span style="width:${score}%;background:${meta.color}"></span></div>
        ${st.riskLevel === 'high' ? `
          <div class="mt-2 text-[11px] text-ink2 flex gap-1.5">
            <span style="color:var(--warn-text)">⚠</span>
            <span>${Utils.esc(this.data.summary.recommendation)}</span>
          </div>` : ''}
      </div>`;
  },

  renderChart(st) {
    const labels = [...st.pastLabels, ...st.forecastLabels];
    const nPast = st.pastLevels.length;

    // ค่าจริง (ถึงเวลาปัจจุบัน) — ต่อด้วย null
    const actual = [...st.pastLevels, ...Array(st.forecastLevels.length).fill(null)];
    // ค่าคาดการณ์ — เริ่มจากจุดปัจจุบันเพื่อให้เส้นต่อเนื่อง
    const forecast = Array(nPast - 1).fill(null)
      .concat([st.pastLevels[nPast - 1]], st.forecastLevels);
    // เส้นเกณฑ์วิกฤต (ค่าคงที่)
    const threshold = labels.map(() => st.floodThreshold);

    const C = CONFIG.COLORS;
    const cfg = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'ระดับน้ำจริง', data: actual,
            borderColor: C.s1, backgroundColor: C.s1 + '1a',
            borderWidth: 2, fill: true, tension: 0.35,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: C.s1, pointHoverBorderColor: C.surface, pointHoverBorderWidth: 2
          },
          {
            label: 'คาดการณ์ AI', data: forecast,
            borderColor: C.s3, borderDash: [6, 4],
            borderWidth: 2, fill: false, tension: 0.35,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: C.s3, pointHoverBorderColor: C.surface, pointHoverBorderWidth: 2
          },
          {
            label: 'เกณฑ์วิกฤต', data: threshold,
            borderColor: C.crit, borderDash: [2, 3],
            borderWidth: 1.5, fill: false,
            pointRadius: 0, pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 18, padding: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ม.`
            }
          }
        },
        scales: {
          x: { grid: { color: C.grid }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            grid: { color: C.grid },
            title: { display: true, text: 'ระดับน้ำ (ม.)', color: C.muted, font: { size: 10 } },
            suggestedMax: st.floodThreshold + 0.3
          }
        }
      }
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('prediction-chart'), cfg);
  },

  renderRain() {
    const r = this.data.rainfall;
    document.getElementById('prediction-rain').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${CONFIG.COLORS.s1}" stroke-width="2" stroke-linecap="round">
        <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/><path d="M8 19v2M12 18v3M16 19v2"/>
      </svg>
      <span>ฝนคาดการณ์ 24 ชม. <b class="text-ink">${r.next24hMm} มม.</b> · โอกาส <b class="text-ink">${Math.round(r.probability * 100)}%</b></span>
      <span class="text-muted hidden md:inline">· ${Utils.esc(r.note)}</span>`;
  }
};
