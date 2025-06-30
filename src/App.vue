<template>
  <NavigationBar @simulation-data-selected="handleDataSelection" />
  <div class="main-content">
    <SatelliteViewer />
    <LatencyTable />
    <SimulationDataPanel 
      :visible="showDataPanel"
      :selectedData="selectedSimulationData"
      @close="showDataPanel = false"
    />
  </div>
</template>

<script setup>
import NavigationBar from "./components/navigation-bar.vue";
import SatelliteViewer from "./components/SatelliteViewer_1.vue";
// import LatencyTable from "./components/LatencyTable.vue";
import SimulationDataPanel from "./components/SimulationDataPanel.vue";
import { ref } from 'vue';

const showDataPanel = ref(false);
const selectedSimulationData = ref({
  networkCongestion: false,
  averageDelay: false,
  switchCount: false
});

const handleDataSelection = (data) => {
  selectedSimulationData.value = data;
  showDataPanel.value = true;
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>