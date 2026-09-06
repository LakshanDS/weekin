<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { addDaysIso } from '#shared/utils/week'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{ trend: { week: string; done: number }[] }>()

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const label = (week: string) => dt.format(new Date(`${addDaysIso(week, 4)}T00:00:00Z`))

const chartData = computed(() => ({
  labels: props.trend.map((t) => label(t.week)),
  datasets: [
    {
      label: 'Tasks done',
      data: props.trend.map((t) => t.done),
      borderColor: '#1f8a5a',
      backgroundColor: 'rgba(31, 138, 90, 0.07)',
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#1f8a5a',
      pointBorderWidth: 1.5,
      pointHoverRadius: 4,
    },
  ],
}))

const options = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      border: { color: '#E8E8E8' },
      ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: '#8A8A8A' },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#ECECEC', borderDash: [3, 5] },
      border: { display: false },
      ticks: { precision: 0, font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: '#8A8A8A' },
    },
  },
}
</script>

<template>
  <Line :data="chartData" :options="options" />
</template>
