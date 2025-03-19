<script setup>
import { onMounted } from 'vue';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

let viewer;
let start, stop;
const arrStates = [];

function mySatePosition() {
  this.lon = 0;
  this.lat = 0;
  this.hei = 700000; // 卫星高度
  this.phei = 700000 / 2; // 轨道高度
  this.time = 0;
}

function computeCirclularFlight(source, panduan) {
  var property = new Cesium.SampledPositionProperty();
  for (var i = 0; i < source.length; i++) {
    var time = Cesium.JulianDate.addSeconds(start, source[i].time, new Cesium.JulianDate);
    var position = Cesium.Cartesian3.fromDegrees(source[i].lon, source[i].lat, panduan === 1 ? source[i].hei : source[i].phei);
    property.addSample(time, position);
  }
  return property;
}

function getRandState(brr, count) {
  for (var m = 0; m < count; m++) {
    var arr = [];
    var t1 = Math.floor(Math.random() * 360);
    var t2 = Math.floor(Math.random() * 360);
    for (var i = t1; i <= 360 + t1; i += 30) {
      var aaa = new mySatePosition();
      aaa.lon = t2;
      aaa.lat = i;
      aaa.time = i - t1;
      arr.push(aaa);
    }
    brr.push(arr);
  }
}

function getStatePath(aaa) {
  var entity_ty1p = computeCirclularFlight(aaa, 2);
  viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
    position: entity_ty1p,
    orientation: new Cesium.VelocityOrientationProperty(entity_ty1p),
    cylinder: {
      HeightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      length: 700000,
      topRadius: 0,
      bottomRadius: 900000 / 2,
      material: Cesium.Color.fromBytes(35, 170, 242, 80)
    }
  });

  var entity1p = computeCirclularFlight(aaa, 1);
  viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
    position: entity1p,
    orientation: new Cesium.VelocityOrientationProperty(entity1p),
    model: {
      uri: './satellite_model/wx.gltf',
      scale: 1000
    },
    path: {
      resolution: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.1,
        color: Cesium.Color.PINK
      }),
      width: 5
    }
  });
}

function startFunc() {
  for (var i = 0; i < arrStates.length; i++) {
    getStatePath(arrStates[i]);
  }
}

onMounted(() => {
	// if (!viewer) {
	//     console.error("Viewer 为空，无法加载卫星！");
	//     return;
	//  }
	start = Cesium.JulianDate.now();
	stop = Cesium.JulianDate.addSeconds(start, 3600, new Cesium.JulianDate);
  
    // 生成随机卫星数据
    getRandState(arrStates, 1);
  
    // 添加卫星
    startFunc();
});
</script>

<template>
  <div id="cesiumContainer" style="width: 100%; height: 100vh;"></div>
</template>

<style scoped>
#cesiumContainer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
}
</style>

