(function(){
  'use strict';
  
  function Canvas(config) {
    var self = this,
      elContainer = null,
      elCanvas = null,
      width = 0, height = 0, zIndex = 0,
      ratioWidth = 1, ratioHeight = 1,
      drawOn = null, color = '', comp = '', size = 1,
      lineStart = null,
      
      DEFAULT_COMPOSITION = 'source-over',
      DEFAULT_ZINDEX = 50,
      USE_TRANSFORM = false;
    
    this.init = function Canvas_init(options) {
      zIndex = options.zIndex || DEFAULT_ZINDEX;
      
      elContainer = document.createElement('div');
      elContainer.className = 'canvasc';
      elContainer.style.cssText += '; z-index: ' + zIndex;
      
      elCanvas = document.createElement('canvas');
      
      self.setSize(options.width, options.height);
      
      drawOn = elCanvas.getContext('2d');
      
      elContainer.appendChild(elCanvas);
      
      drawOn.lineJoin = 'round';
      drawOn.lineCap = 'round';
      self.styleLine(options);
      
      return elContainer;
    };
    
    this.remove = function remove() {
      elContainer.parentNode.removeChild(elContainer);
    };
    
    this.setSize = function setSize(newWidth, newHeight) {
      width = newWidth;
      height = newHeight;
      
      var screenWidth = width,
          screenHeight = height,
          pixelRatio = navigator.devicePixelRatio || 1;
      
      elCanvas.width = width * pixelRatio;
      elCanvas.height = height * pixelRatio;
      
      if (pixelRatio !== 1) {
        elCanvas.style.cssText += 'width: ' + elCanvas.width/pixelRatio + 'px; height: ' + elCanvas.height/pixelRatio + 'px;';
      }
      
      ratioWidth = screenWidth*pixelRatio/width;
      ratioHeight = screenHeight*pixelRatio/height;
      
      if (USE_TRANSFORM && (ratioWidth !== 1 || ratioHeight !== 1)) {
        elCanvas.style.transform = "scale(" + ratioWidth + "," + ratioHeight + ")"
        ratioWidth = ratioHeight = 1;
      }
    };
    
    // drawing methods
    // ----------------
    this.startLine = function Canvas_startLine(point) {
      lineStart = point;
    };

    this.drawLine = function Canvas_drawLine(point) {
      drawOn.beginPath();
      
      drawOn.moveTo(lineStart[0]*ratioWidth, lineStart[1]*ratioHeight);
      drawOn.lineTo(point[0]*ratioWidth, point[1]*ratioHeight);
      
      drawOn.stroke();
      lineStart = point;
    };
    this.endLine = function Canvas_endLine() {
      drawOn.closePath();
    };
    
    this.drawPoint = function Canvas_drawPoint(point) {
      drawOn.beginPath();
      drawOn.arc(point[0]*ratioWidth, point[1]*ratioHeight, size/2*ratioHeight, 0, 2 * Math.PI, true);
      drawOn.fill();
    };
    
    this.clear = function Canvas_clear() {
      drawOn.clearRect(0, 0, elCanvas.width, elCanvas.height);
      drawOn.closePath();
    };
    
    // getters
    // ----------------
    this.get = function Canvas_get() { return elContainer; };
    this.getCanvas = function Canvas_getCanvas() { return elCanvas; };
    this.getWidth = function Canvas_getWidth() { return width; };
    this.getHeight = function Canvas_getHeight() { return height; };
    this.getDrawingBoard = function Canvas_getDrawingBoard() { return drawOn; };
    this.getBrush = function Canvas_getBrush() {
      return {
        'color': color,
        'size': size,
        'comp': comp
      };
    };
    
    this.setComp = function Canvas_setComp(newComposition) {
      comp = newComposition || DEFAULT_COMPOSITION;
      drawOn.globalCompositeOperation = comp;
    };
    
    this.styleLine = function Canvas_styleLine(options) {
      if (options.color) {
        color = options.color;
        drawOn.strokeStyle = color;
        drawOn.fillStyle = color;
        
        self.setComp(options.comp);
      }
      
      
      if (options.size) {
        size = options.size;
        drawOn.lineWidth = size*(ratioWidth+ratioHeight)/2;
      }
    };
    
    this.putImage = function Canvas_putImage(src) {
      var image = new Image();
      image.onload = function onImageLoad() {
        self.clear();
        drawOn.globalCompositeOperation = DEFAULT_COMPOSITION;
        drawOn.drawImage(image, 0, 0);
        drawOn.globalCompositeOperation = comp;
      };
      image.src = src;
    };
    
    this.getImage = function Canvas_getImage() {
      return elCanvas.toDataURL();
    };
    
    config && self.init(config);
  }
  
  window.Canvas = Canvas;
}());