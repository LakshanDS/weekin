<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps<{ rows: { name: string; hours: number }[] }>()

const chartData = computed(() => ({
  labels: props.rows.map((r) => r.name),
  datasets: [
    {
      label: 'Hours logged',
      data: props.rows.map((r) => r.hours),
      backgroundColor: '#2f6fde',
    },
  ],
}))

const options = {
  indexAxis: 'y' as const,
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { x: { beginAtZero: true } },
}
</script>

<template>
  <Bar :data="chartData" :options="options" />
</template>
