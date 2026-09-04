<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{ rows: { name: string; DRAFT: number; SUBMITTED: number; NEEDS_CORRECTION: number; APPROVED: number }[] }>()

const chartData = computed(() => ({
  labels: props.rows.map((r) => r.name.split(' ')[0]),
  datasets: [
    { label: 'Approved', data: props.rows.map((r) => r.APPROVED), backgroundColor: '#1f8a5a' },
    { label: 'Needs correction', data: props.rows.map((r) => r.NEEDS_CORRECTION), backgroundColor: '#d97e00' },
    { label: 'Submitted', data: props.rows.map((r) => r.SUBMITTED), backgroundColor: '#2f6fde' },
    { label: 'Draft', data: props.rows.map((r) => r.DRAFT), backgroundColor: '#93a1ad' },
  ],
}))

const options = {
  responsive: true,
  scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } } },
}
</script>

<template>
  <Bar :data="chartData" :options="options" />
</template>
