<script setup lang="ts">
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{ hours: Record<string, number> }>()

const COLORS: Record<string, string> = {
  development: '#2f6fde',
  testing: '#1f8a5a',
  meetings: '#d97e00',
  documentation: '#93a1ad',
}

const chartData = computed(() => ({
  labels: Object.keys(props.hours),
  datasets: [
    {
      data: Object.values(props.hours),
      backgroundColor: Object.keys(props.hours).map((k) => COLORS[k] ?? '#47617a'),
      borderWidth: 0,
    },
  ],
}))

const options = {
  responsive: true,
  cutout: '62%',
  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } } },
}
</script>

<template>
  <Doughnut :data="chartData" :options="options" />
</template>
