<template>
  <div id="cesiumContainer" style="width: 100%; height: 100%;"></div>
</template>

<script setup>
import * as Cesium from "cesium";
import "./Widgets/widgets.css";
import { onMounted } from "vue";

onMounted(async () => {
  // 等待地形加载完成
  const terrainProvider = await Cesium.createWorldTerrainAsync();

  // 初始化 Cesium Viewer
  var viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: terrainProvider,
    infoBox: true,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    animation: true,
    timeline: true,
    fullscreenButton: false,
  });

  // 隐藏版权信息
  viewer.cesiumWidget.creditContainer.style.display = "none";

  // // 设置默认视角
  // const rectangle = Cesium.Rectangle.fromDegrees(15.8651, 28.7019, 115.8709, 28.7053);
  // const centerCartographic = Cesium.Rectangle.center(rectangle, new Cesium.Cartographic());
  // const centerCartesian = Cesium.Cartographic.toCartesian(centerCartographic);

  // viewer.scene.camera.setView({
  //   destination: centerCartesian,
  //   orientation: {
  //     heading: Cesium.Math.toRadians(0.0),
  //     pitch: Cesium.Math.toRadians(-30.0),
  //     roll: 0.0,
  //   },
  // });
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
* {
  margin: 0;
  padding: 0;
}
</style>