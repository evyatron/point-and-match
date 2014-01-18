(function(){
  'use strict';
  
  function TouchHandler(config){
    var self = this,
        $el = null, canvas = null, path = null, moving = false, enabled = true,
        cbStart = null, cbMove = null, cbEnd = null,
        offsetX = 0, offsetY = 0, ratioWidth = 1, ratioHeight = 1;
        
    this.init = function TouchHandler_init(options) {
      $el = options.$el;
      
      canvas = options.canvas;
      
      cbStart = options.onStart;
      cbMove = options.onMove;
      cbEnd = options.onEnd;
      
      options.path.canvas = canvas;
      path = new Path(options.path);
      
      self.updateOffset();
      
      $el.addEventListener(EVENTS.POINTER_DOWN, self.start);
      document.addEventListener(EVENTS.POINTER_MOVE, self.move);
      document.addEventListener(EVENTS.POINTER_END, self.end);
      
      if (options.cancelBodyMove) {
        document.body.addEventListener(EVENTS.POINTER_MOVE, function(e){
          e.preventDefault();
        });
      }
    };
    
    this.updateOffset = function TouchHandler_updateOffset(newRatioWidth, newRatioHeight) {
      if (!$el) { return; }
      
      ratioWidth = newRatioWidth || 1;
      ratioHeight = newRatioHeight || 1;
      
      var bounds = $el.parentNode.getBoundingClientRect();

      offsetX = bounds.left;
      offsetY = bounds.top;
    };
    
    this.start = function TouchHandler_start(e) {
      if (!enabled) { return; }
      
      self.updateOffset();

      var t = (e.touches || [e])[0],
          point = [(t.pageX-offsetX) / ratioWidth, (t.pageY-offsetY) / ratioHeight];

      path.begin(point);
      moving = true;
      
      cbStart(point);
    };
    
    this.move = function TouchHandler_move(e) {
      if (!enabled) { return; }
      if (!moving) { return; }
      
      var t = (e.changedTouches || e.touches || [e])[0],
          point = [(t.pageX-offsetX) / ratioWidth, (t.pageY-offsetY) / ratioHeight];

      path.move(point);
      
      cbMove(point);
    };
    
    this.end = function TouchHandler_end() {
        if (!enabled) { return; }
      if (!moving) { return; }
      
      path.end();
      moving = false;
      
      cbEnd(path.getPoints());
    };
    
    this.disable = function TouchHandler_disable() {
      enabled = false;
    };
    
    this.enable = function TouchHandler_disable() {
      enabled = false;
    };
    
    config && this.init(config);
  }
  
  window.TouchHandler = TouchHandler;
}());