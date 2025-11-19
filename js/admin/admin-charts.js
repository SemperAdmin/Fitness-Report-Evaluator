window.AdminCharts = (function() {
  let chart;
  function renderGradeDistribution(ctxId, data) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return;
    const hasChartJS = typeof window.Chart === 'function';
    if (!hasChartJS) return; // Chart.js to be added in later phases
    const labels = (data?.labels) || ['A','B','C','D','E','F','G'];
    const values = (data?.values) || [0,0,0,0,0,0,0];
    chart?.destroy?.();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Grades', data: values, backgroundColor: '#4ea1ff' }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
  function renderPerformanceTiers(ctxId, tiers) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return;
    const hasChartJS = typeof window.Chart === 'function';
    if (!hasChartJS) return;
    const labels = ['Top', 'Middle', 'Developing'];
    const values = [
      (tiers?.top ?? 0),
      (tiers?.middle ?? 0),
      (tiers?.developing ?? 0)
    ];
    chart?.destroy?.();
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#49d28d', '#4ea1ff', '#f59e0b']
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
  function renderSectionAverages(ctxId, labels, values) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return;
    const hasChartJS = typeof window.Chart === 'function';
    if (!hasChartJS) return;
    chart?.destroy?.();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: Array.isArray(labels) ? labels : [],
        datasets: [{ label: 'Section Avg', data: Array.isArray(values) ? values : [], backgroundColor: '#10b981' }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
  function renderRankDistribution(ctxId, labels, values) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return;
    const hasChartJS = typeof window.Chart === 'function';
    if (!hasChartJS) return;
    chart?.destroy?.();
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Array.isArray(labels) ? labels : [],
        datasets: [{ data: Array.isArray(values) ? values : [], backgroundColor: ['#4ea1ff','#49d28d','#f59e0b','#ef4444','#8b5cf6','#22c55e','#eab308'] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
  return { renderGradeDistribution, renderPerformanceTiers, renderSectionAverages, renderRankDistribution };
})();
