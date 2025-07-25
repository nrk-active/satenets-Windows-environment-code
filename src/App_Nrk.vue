<template>
  <NavigationBar @simulation-data-selected="handleDataSelection" />
  <div class="main-content-flex">
    <ObjectViewer />
    <div class="main-center-content">
      <SatelliteViewer />
      <LatencyTable />
      <SimulationDataPanel 
        :visible="showDataPanel"
        :selectedData="selectedSimulationData"
        @close="showDataPanel = false"
      />

    </div>
    <SatelliteInfoPanel />
  </div>
  <!-- <ServerData /> -->
</template>

<script setup>
import NavigationBar from "./components/navigation-bar.vue";
import SatelliteViewer from "./components/SatelliteViewer.vue";
// import LatencyTable from "./components/LatencyTable.vue";
import SimulationDataPanel from "./components/SimulationDataPanel.vue";
import ObjectViewer from "./components/ObjectViewer.vue";
import SatelliteInfoPanel from "./components/SatelliteInfoPanel.vue";
import { ref } from 'vue';
// import ServerData from './components/serverdata.vue'

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

.main-content-flex {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.main-center-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>