<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.9" tiledversion="1.9.2" name="terrain" tilewidth="32" tileheight="32" tilecount="8" columns="4">
 <image source="../../Tilesets/terrain.png" width="128" height="64"/>
 <tile id="3">
  <animation>
   <frame tileid="3" duration="100"/>
   <frame tileid="7" duration="100"/>
  </animation>
 </tile>
 <wangsets>
  <wangset name="grass" type="corner" tile="0">
   <wangcolor name="" color="#ff0000" tile="-1" probability="1"/>
   <wangtile tileid="0" wangid="0,1,0,1,0,1,0,1"/>
   <wangtile tileid="1" wangid="0,0,0,1,0,1,0,0"/>
  </wangset>
 </wangsets>
</tileset>
