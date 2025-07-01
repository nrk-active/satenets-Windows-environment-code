<template>
  <div class="sat-info-panel">
    <table class="sat-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Longitude</th>
          <th>Latitude</th>
          <th>Altitude</th>
          <th>Velocity</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sat-1</td>
          <td>120.1</td>
          <td>30.2</td>
          <td>500km</td>
          <td>7.8km/s</td>
        </tr>
      </tbody>
    </table>
    <div class="passes">
      <div class="passes-title">Passes</div>
      <table>
        <tr>
          <td>Countdown</td>
          <td>Start</td>
          <td>End</td>
          <td>El</td>
          <td>Az</td>
        </tr>
        <tr>
          <td>00:05:12</td>
          <td>12:00</td>
          <td>12:10</td>
          <td>45°</td>
          <td>180°</td>
        </tr>
      </table>
    </div>
    <div class="tle">
      <div class="tle-title">TLE</div>
      <pre>1 25544U 98067A   ...</pre>
    </div>
  </div>
</template>

<script setup>
// 可用props传递卫星数据
</script>

<style scoped>
.sat-info-panel {
  background: #232323;
  border-left: 1px solid #333;
  height: 100%;
  padding: 14px 10px 10px 10px;
  font-size: 13px;
  color: #f1f1f1;
}
.sat-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  background: #232323;
}
.sat-table th, .sat-table td {
  border: 1px solid #444;
  padding: 6px 8px;
  text-align: center;
  color: #f1f1f1;
  background: #232323;
}
.sat-table th {
  background: #181818;
  color: #ffd700;
  font-weight: bold;
}
.passes {
  margin-bottom: 12px;
}
.passes-title {
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 2px;
}
.passes table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: #232323;
}
.passes td {
  border: 1px solid #444;
  padding: 4px 6px;
  color: #f1f1f1;
}
.tle {
  background: #181818;
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #ffd700;
}
.tle-title {
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 2px;
}
</style>