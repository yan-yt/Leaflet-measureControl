//距离测量
L.Polyline.Measure = L.Draw.Polyline.extend({
  options : {
    icon: new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: 'leaflet-div-icon leaflet-editing-icon'
		}),
		touchIcon: new L.DivIcon({
			iconSize: new L.Point(10, 10),
			className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
    })
  },
  initialize: function(map,options) {
    L.Draw.Polyline.prototype.initialize.call(this, map,options);
    this.count = 0;
  },
  addHooks: function() {
    L.Draw.Feature.prototype.addHooks.call(this);
    if (this._map) {
      this._markers = [];

			this._markerGroup = new L.LayerGroup();
			this._map.addLayer(this._markerGroup);

      this._poly = new L.Polyline([], this.options.shapeOptions);
      
      this._markerInfo = new L.LayerGroup();
      this.options.featureGroup.addLayer(this._markerInfo);

      this._markerPoints = new L.LayerGroup();
      this.options.featureGroup.addLayer(this._markerPoints);

      this._map.on(L.Draw.Event.DRAWVERTEX, this._drawVertex, this);
      this._map.on(L.Draw.Event.CREATED, this._createdPloy, this);
      L.drawLocal.draw.handlers.polyline.tooltip.start = this.options.text.disTooltipText;
      L.drawLocal.draw.handlers.polyline.tooltip.cont = this.options.text.disTooltipText;
      L.drawLocal.draw.handlers.polyline.tooltip.end = this.options.text.disTooltipText;
      L.drawLocal.draw.handlers.polyline.error = this.options.text.errorText;
      if (!this._mouseMarker) {
				this._mouseMarker = L.marker(this._map.getCenter(), {
					icon: L.divIcon({
						className: 'leaflet-mouse-marker',
						iconAnchor: [20, 20],
						iconSize: [40, 40]
					}),
					opacity: 0,
					zIndexOffset: this.options.zIndexOffset
				});
			}

			this._mouseMarker
				.on('mouseout', this._onMouseOut, this)
				.on('mousemove', this._onMouseMove, this) // Necessary to prevent 0.8 stutter
				.on('mousedown', this._onMouseDown, this)
				.on('mouseup', this._onMouseUp, this) // Necessary for 0.8 compatibility
				.addTo(this._map);

			this._map
				.on('mouseup', this._onMouseUp, this) // Necessary for 0.7 compatibility
				.on('mousemove', this._onMouseMove, this)
				.on('zoomlevelschange', this._onZoomEnd, this)
				.on('touchstart', this._onTouch, this)
				.on('zoomend', this._onZoomEnd, this);
      this._startShape();
    }
  },
  removeHooks: function() {
    L.Draw.Feature.prototype.removeHooks.call(this);

    this._clearHideErrorTimeout();

    this._cleanUpShape();

    this._map.removeLayer(this._markerGroup);
    delete this._markerGroup;
    delete this._markers;

    this._map.removeLayer(this._poly);
    delete this._poly;

    this._mouseMarker
      .off('mousedown', this._onMouseDown, this)
      .off('mouseout', this._onMouseOut, this)
      .off('mouseup', this._onMouseUp, this)
      .off('mousemove', this._onMouseMove, this);
    this._map.removeLayer(this._mouseMarker);
    delete this._mouseMarker;

    // clean up DOM
    this._clearGuides();
    //this._container.style.cursor = '';

    this._map
      .off('mouseup', this._onMouseUp, this)
      .off('mousemove', this._onMouseMove, this)
      .off('zoomlevelschange', this._onZoomEnd, this)
      .off('zoomend', this._onZoomEnd, this)
      .off('touchstart', this._onTouch, this)
      .off('click', this._onTouch, this)
      .off(L.Draw.Event.DRAWVERTEX, this._drawVertex, this)
      .off(L.Draw.Event.CREATED, this._createdPloy, this);
    this._removeShape();
  },

  _startShape: function() {
    this._drawing = true;
    this.options.shapeOptions = {
      color: '#569cf1',
      width: 3,
      opacity : 1
    };

    this._poly = new L.Polyline([], this.options.shapeOptions);

    this._poly._onClick = function() {};

    //this._container.style.cursor = 'crosshair';

    //this._updateTooltip();
    this._map
      .on('pointermove', this._onMouseMove, this)
      .on('mousemove', this._onMouseMove, this);

  },

  _finishShape: function() {
    this._drawing = false;

    this._cleanUpShape();
    this._clearGuides();

    this._updateTooltip();
    this._fireCreatedEvent();
    this.disable();

    this._map
      .off('pointermove', this._onMouseMove, this)
      .off('mousemove', this._onMouseMove, this);

    //this._container.style.cursor = '';

  },

  _removeShape: function() {
    if (!this._poly) return;
    this._map.removeLayer(this._poly);
    delete this._poly;

    this._markers.splice(0);

    this._markerInfo.clearLayers(); //清理自定义图层
  },

  _onClick: function() {
    if (!this._drawing) {
      this._removeShape();
      return;
    }

  },
  _vertexChanged: function(t, e) {
    this._updateFinishHandler(),
      this._updateRunningMeasure(t, e),
      this._clearGuides(),
      this._updateTooltip(),
      this._map.fire("draw:drawvertex", {
        layers: this._markerGroup
      })
  },
  _drawVertex: function() {
    var latLng = this._currentLatLng;
    var res = this._getTooltipText();

    var markerCount = this._markers.length;
    if (markerCount === 1) {
      var midDis = L.divIcon({
        className: 'mid-Dis',
        html: '<div style = "position: absolute; font-size: 12px; font-family: MicrosoftYaHei; white-space: nowarp; height: 24px; background-color: #fff; margin-top: 5px;margin-left: 5px; color: #666; border: 1px solid #d4d4d4">' +
          '<div style = "padding: 3px 8px; position: relative; display: inline-block; height: 24px; line-height: 140%; white-space: nowrap">' +
          '<strong>'+this.options.text.startingPoint+'</strong>' +
          '</div></div>',
        iconSize: []
      });
    } else {
      midDis = L.divIcon({
        className: 'mid-Dis',

        html: '<div style = "position: absolute; font-size: 12px; font-family: MicrosoftYaHei; white-space: nowarp; height: 24px; background-color: #fff;  margin-top: 5px;margin-left: 5px; color: #666; border: 1px solid #d4d4d4">' +
          '<div style = "padding: 3px 8px; position: relative; display: inline-block; height: 24px; line-height: 140%; white-space: nowrap">' +
          '<strong>' + res.subtext + '</strong>' +
          '</div></div>',
        iconSize: []
      });
    }
    var marker = L.marker([latLng.lat, latLng.lng], {
      icon: midDis,
      zIndexOffset : this.options.zIndexOffset
    });
    //将marker存起来
    marker.addTo(this._markerInfo);
  },
  _createdPloy: function(event) {
    //添加线
    this.options.featureGroup.addLayer(event.layer);
    //添加圆点
    var lat,lng;
    for(var i in  this._markerGroup._layers ){
      lat = this._markerGroup._layers[i]._latlng.lat;
      lng = this._markerGroup._layers[i]._latlng.lng;
      var myIcon = L.divIcon({className: 'markerPoint' ,iconSize : L.point(10, 10)});
      L.marker([lat, lng],{icon: myIcon}).addTo(this._markerPoints);
    }

    var lastMarkerId = this._markerInfo.getLayers()[this._markers.length - 1]._leaflet_id; //获取最后一个信息marker的id
    this._markerInfo.removeLayer(lastMarkerId); //移除最后一个图层
    //添加最后的测量信息
    var latLng = this._currentLatLng;
    var res = this._getTooltipText();
    var midDis = L.divIcon({
      className: 'mid-Dis',
      html: '<div style = "position: absolute; white-space: nowrap;font-size: 13px;font-family: MicrosoftYaHei;color: #666666; margin-top: 5px;margin-left: 5px;height : 24px;">' +
        '<span style="padding: 4px 4px;border: 1px solid #4a90e2;background-color:#fff">'+this.options.text.totalLength+':' +
        '<strong style = "color : #4a90e2; letter-spacing: -0.08px;font-family: MicrosoftYaHei-Bold">' + res.subtext + '</strong></span>' +
        '<span id = "measureDis' + this.count + '" class="supermapol-icons-clear" style = "padding:6px 4px;width:22px;height22px;background-color: #FFFFFF;color:#4A90E2;line-height:22px;text-align:center;cursor: pointer;border: 1px solid #4A90E2;position:relative;top:0px;left:6px;">' +
        '</span></div>',
      iconSize: []
    });
    var marker = L.marker([latLng.lat, latLng.lng], {
      icon: midDis,
      zIndexOffset : this.options.zIndexOffset + 300
    });
    //将marker存起来
    marker.addTo(this._markerInfo);

    var markerPane = marker.getPane();
    var clear = markerPane.querySelector("#measureDis" + this.count); //获取清除的span

    var poly = event.layer;
    var map = this._map;
    var markers = this._markers;
    var markerInfo = this._markerInfo;
    var markerGroup = this._markerGroup;
   var markerPoints = this._markerPoints;

    clear.addEventListener('click', function() {
      map.removeLayer(poly);
      delete poly;
      markers.splice(0);
      markerInfo.clearLayers();
      markerGroup.clearLayers();
      markerPoints.clearLayers();
    });
    this.count++;
  },
  _getTooltipText: function() {
    var showLength = this.options.showLength,
      labelText, distanceStr;

    if (this._markers.length === 0) {
      labelText = {
        text: L.drawLocal.draw.handlers.polyline.tooltip.start
      };
    } else {
      distanceStr = showLength ? this._getMeasurementString() : '';

      if (this._markers.length === 1) {
        labelText = {
          text: L.drawLocal.draw.handlers.polyline.tooltip.cont,
          subtext: distanceStr
        };
      } else {
        labelText = {
          text: L.drawLocal.draw.handlers.polyline.tooltip.end,
          subtext: distanceStr
        };
      }
    }
    return labelText;
  },
  _createMarker: function (latlng) {
    var icon = L.divIcon({
      className : 'clickPoint'
    });
		var marker = new L.Marker(latlng, {
			icon: icon,
			zIndexOffset: this.options.zIndexOffset * 2
		});

		this._markerGroup.addLayer(marker);

		return marker;
	}

});
//面积测量
L.Polygon.Measure = L.Draw.Polygon.extend({
  options : {
    icon: new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: 'leaflet-div-icon leaflet-editing-icon'
		}),
		touchIcon: new L.DivIcon({
			iconSize: new L.Point(10, 10),
			className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
    }),
    showArea : true,
    allowIntersection : false,
    metric : 'km',
    shapeOptions : {
      width : 2,
      color : "#569cf1",
      fill:true,
      fillColor : "#00be9c",
      opacity : 1,
      fillOpacity : 0.6
    }
  },
  initialize: function(map, options) {
    L.Draw.Polygon.prototype.initialize.call(this, map, options);
    this.count = 0;
  },
  addHooks: function() {
    L.Draw.Feature.prototype.addHooks.call(this);
    L.drawLocal.draw.handlers.polygon.tooltip.start = this.options.text.areaTooltipText;
    L.drawLocal.draw.handlers.polygon.tooltip.cont = this.options.text.areaTooltipText;
    L.drawLocal.draw.handlers.polygon.tooltip.end = this.options.text.areaTooltipText;
    L.drawLocal.draw.handlers.polyline.error = this.options.text.errorText;

    if (this._map) {
			this._markers = [];

			this._markerGroup = new L.LayerGroup();
			this._map.addLayer(this._markerGroup);

			this._poly = new L.Polyline([], this.options.shapeOptions);

      this._markerInfo = new L.LayerGroup();
      this.options.featureGroup.addLayer(this._markerInfo);

      this._markerPoints = new L.LayerGroup();
      this.options.featureGroup.addLayer(this._markerPoints);
      this._map.on(L.Draw.Event.CREATED, this._createdPloy, this);
      if (!this._mouseMarker) {
        this._mouseMarker = L.marker(this._map.getCenter(), {
          icon: L.divIcon({
            className: 'leaflet-mouse-marker',
            iconAnchor: [20, 20],
            iconSize: [40, 40]
          }),
          opacity: 0,
          zIndexOffset: this.options.zIndexOffset
        });
      }

      this._mouseMarker
        .on('mouseout', this._onMouseOut, this)
        .on('mousemove', this._onMouseMove, this) // Necessary to prevent 0.8 stutter
        .on('mousedown', this._onMouseDown, this)
        .on('mouseup', this._onMouseUp, this) // Necessary for 0.8 compatibility
        .addTo(this._map);

      this._map
        .on('mouseup', this._onMouseUp, this) // Necessary for 0.7 compatibility
        .on('mousemove', this._onMouseMove, this)
        .on('zoomlevelschange', this._onZoomEnd, this)
        .on('touchstart', this._onTouch, this)
        .on('zoomend', this._onZoomEnd, this);
    }
  },
  removeHooks: function() {
    L.Draw.Feature.prototype.removeHooks.call(this);

    this._clearHideErrorTimeout();

    this._cleanUpShape();

    this._map.removeLayer(this._markerGroup);
    delete this._markerGroup;
    delete this._markers;

    this._map.removeLayer(this._poly);
    delete this._poly;

    this._mouseMarker
      .off('mousedown', this._onMouseDown, this)
      .off('mouseout', this._onMouseOut, this)
      .off('mouseup', this._onMouseUp, this)
      .off('mousemove', this._onMouseMove, this);
    this._map.removeLayer(this._mouseMarker);
    delete this._mouseMarker;

    this._clearGuides();
    //this._container.style.cursor = '';

    this._map
      .off('mouseup', this._onMouseUp, this)
      .off('mousemove', this._onMouseMove, this)
      .off('zoomlevelschange', this._onZoomEnd, this)
      .off('zoomend', this._onZoomEnd, this)
      .off('touchstart', this._onTouch, this)
      .off('click', this._onTouch, this)
      .off(L.Draw.Event.CREATED, this._createdPloy, this);
  },
  _createdPloy: function(event) {
    var lat,lng;
    for(var i in  this._markerGroup._layers ){
      lat = this._markerGroup._layers[i]._latlng.lat;
      lng = this._markerGroup._layers[i]._latlng.lng;
      var myIcon = L.divIcon({className: 'markerPoint' ,iconSize : L.point(10, 10)});
      L.marker([lat, lng],{icon: myIcon}).addTo(this._markerPoints);
    }

    this.options.featureGroup.addLayer(event.layer);
    var res = this._getTooltipText();
    var latLng = event.layer.getCenter();
    var areaMarker = L.divIcon({
      className: 'measure-area',
      html: '<div style="position: absolute;white-space: nowrap; font-size: 13px;line-height: 23px;font-family: MicrosoftYaHei;color: #666666;height:24px;">'+
      '<span style="padding:4px 4px;background-color: #FFFFFF;border: 1px solid #4A90E2; ">'+ this.options.text.totalArea +'：<strong style="color:#4a90e2;letter-spacing: -0.08px;font-family: MicrosoftYaHei-Bold">' + res.subtext.substring(4) + '</strong></span>'+
      '<span id = "measureArea' + this.count + '" class="supermapol-icons-clear" style="padding:6px 4px;width:25px;background-color: #FFFFFF;color:#4A90E2;line-height:22px;text-align:center;cursor: pointer;border: 1px solid #4A90E2;position:relative;top:0px;left:6px;">'+
      '</span></div>'
    })
    var marker = L.marker([latLng.lat, latLng.lng], {
      icon: areaMarker,
      zIndexOffset : this.options.zIndexOffset + 300
    });
    marker.addTo(this._markerInfo);

    var markerPane = marker.getPane();
    var clear = markerPane.querySelector("#measureArea" + this.count); //获取清除的span
    var poly = event.layer;
    var map = this._map;
    var markers = this._markers;
    var markerInfo = this._markerInfo;
    var markerGroup = this._markerGroup;
    var markerPoints = this._markerPoints;

    clear.addEventListener('click', function() {
      map.removeLayer(poly);
      delete poly;
      markers.splice(0);
      markerInfo.clearLayers();
      markerGroup.clearLayers();
      markerPoints.clearLayers();
    });
    this.count++;
  },
  _createMarker: function (latlng) {
    var icon = L.divIcon({
      className : 'clickPoint'
    });
		var marker = new L.Marker(latlng, {
			icon: icon,
			zIndexOffset: this.options.zIndexOffset * 2
		});

		this._markerGroup.addLayer(marker);

		return marker;
	}
});



L.Control.MeasureControl = L.Control.extend({

  statics: {
    TITLE: ''
  },
  options: {
    position: 'topleft',
    handlers: {
      text : {
        disTooltipText : '',
        startingPoint : '',
        totalLength : '',
        totalArea : '',
        disTitle  : '',
        areaTooltipText : '',
        areaTitle : '',
        clearTitle : '',
        errorText : '',
        disText : '',
        areaText : '',
        clearText : ''
      }
    }
  },

  toggleDis: function() {
    if (this.handlers.Polyline.handler.enabled()) {
      this.handlers.Polyline.handler.disable();
    } else {
      this.handlers.Polyline.handler.enable();
    }
    this.handlers.Polygon.handler.disable();
  },
  toggleArea : function (){
     if (this.handlers.Polygon.handler.enabled()) {
      this.handlers.Polygon.handler.disable();
    } else {
      this.handlers.Polygon.handler.enable();
    }
    this.handlers.Polyline.handler.disable();
  },
  toggleClear : function() {
    this.handlers.Polygon.handler.disable();
    this.handlers.Polyline.handler.disable();
    this.options.handler.featureGroup.clearLayers();
  },

  onAdd: function(map) {
    this.options.handler.featureGroup = new L.featureGroup();
    this.options.handler.featureGroup.addTo(map);
    //添加控件到地图上
    var dis = null,
      area = null,
      clear = null;

    this._container = L.DomUtil.create('div', 'leaflet-measureBar');
    //距离测量
    var measureDis = L.DomUtil.create('div','measureDisBtn');
    this._container.appendChild(measureDis);
    //面积测量
    var measureArea = L.DomUtil.create('div','measureAreaBtn');
    this._container.appendChild(measureArea);
    //清空图层
    var measureClear = L.DomUtil.create('div','measureClearAll');
    this._container.appendChild(measureClear);

    this.handlers = {
      Polyline: {
        measurePopup: measureDis,
        handler: new L.Polyline.Measure(map, this.options.handler),
      },
      Polygon: {
        measurePopup: measureArea,
        handler: new L.Polygon.Measure(map, this.options.handler),
      }
    };
    //距离测量
    dis = L.DomUtil.create('a', 'measureDis', measureDis);
    dis.innerHTML = this.options.handler.text.disText;
    dis.href = '#';
    dis.title = this.options.handlers.text.disTitle;
    this._dis = dis;

    //面积测量
    area = L.DomUtil.create('a', 'measureArea', measureArea);
    area.innerHTML = this.options.handler.text.areaText;
    area.href = '#';
    area.title = this.options.handlers.text.areaTitle;
    this._area = area;

    //清空图层
    clear = L.DomUtil.create('a', 'measureClear', measureClear);
    clear.innerHTML = this.options.handler.text.clearText;
    clear.href = '#';
    clear.title = this.options.handlers.text.clearTitle;
    this._clear = clear;
    this.addListenControl();

    //测距离高亮
    this.handlers.Polyline.handler.on('enabled',function(){
      $(".leaflet-measureBar>.measureAreaBtn").removeClass('measureActiveBtn');
      $(".leaflet-measureBar>.measureDisBtn").addClass('measureActiveBtn');
    });
    this.handlers.Polyline.handler.on('disabled',function(){
      $(".leaflet-measureBar>.measureDisBtn").removeClass('measureActiveBtn');
      $(".leaflet-measureBar>.measureClearAll").removeClass('disableClearBtn');
    });
    //测面积高亮
    this.handlers.Polygon.handler.on('enabled',function(){
      $(".leaflet-measureBar>.measureDisBtn").removeClass('measureActiveBtn');
      $(".leaflet-measureBar>.measureAreaBtn").addClass('measureActiveBtn');
    });
    this.handlers.Polygon.handler.on('disabled',function(){
      $(".leaflet-measureBar>.measureAreaBtn").removeClass('measureActiveBtn');
      $(".leaflet-measureBar>.measureClearAll").removeClass('disableClearBtn');
    });

    return this._container;    
  },
  addListenControl : function(){
    L.DomEvent
      .addListener(this._dis, 'click', L.DomEvent.stopPropagation)
      .addListener(this._dis, 'click', L.DomEvent.preventDefault)
      .addListener(this._dis, 'click', this.toggleDis, this);

    L.DomEvent
      .addListener(this._area, 'click', L.DomEvent.stopPropagation)
      .addListener(this._area, 'click', L.DomEvent.preventDefault)
      .addListener(this._area, 'click', this.toggleArea, this);

    L.DomEvent
      .addListener(this._clear, 'click', L.DomEvent.stopPropagation)
      .addListener(this._clear, 'click', L.DomEvent.preventDefault)
      .addListener(this._clear, 'click', this.toggleClear, this);
  }
});


L.Map.mergeOptions({
  measureControl: false
});


L.Map.addInitHook(function() {
  if (this.options.measureControl) {
    this.measureControl = L.Control.measureControl().addTo(this); //
  }
});


L.Control.measureControl = function(options) {
  return new L.Control.MeasureControl(options);
};