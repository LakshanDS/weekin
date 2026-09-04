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
      backgroundColor: 'rgba(31, 138, 90, 0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
    },
  ],
}))

const options = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
</script>

<template>
  <Line :data="chartData" :options="options" />
</template>
