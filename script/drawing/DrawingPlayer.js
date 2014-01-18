(function(){
  'use strict';
  
  // plays saved drawings
  function DrawingPlayer(config) {
    var self = this,
      canvas = config.canvas, actions = config.actions, speed = config.speed, currentSpeed = speed,
      brushStyleBeforePlayback = null, clearOnStart = config.clear,
      onStart = config.onStart, onEnd = config.onEnd, onProgress = config.onProgress,
      
      iAction = 0, iPoint = 0, path = null, points = null, history = [],
      timeoutLoop = null,
      
      progressMax = 0, progressCurrent = 0,
      
      DISPLAY_UNDO_AS_STEP = false,
      FUNCTIONS = {
        "draw": handle_draw,
        "undo": handle_undo
      };
    
    this.start = function Player_start() {
      if (canvas.playing || actions.length === 0) {
        return;
      }
      
      Utils.hideAddressBar();
      
      brushStyleBeforePlayback = canvas.getBrush();
      
      clearOnStart && canvas.clear();
      
      canvas.playing = true;
      
      progressCurrent = 0;
      iAction = 0;
      iPoint = 0;
      path = null;
      
      onStart && onStart(actions);
      
      clearUndos();
      
      setProgressMax();
      
      loop();
    };
    
    this.add = function Player_add(actionsToAdd, run) {
      if (!Array.isArray(actionsToAdd)) {
         actionsToAdd = [actionsToAdd];
      }
      
      if (actionsToAdd.length > 0) {
        actions = actions.concat(actionsToAdd);
        if (run) {
          self.start();
        }
      }
    };
    
    this.stop = function Player_stop() {
      window.clearTimeout(timeoutLoop);
      done();
    };
    
    this.goToStart = function Player_goToStart() {
      currentSpeed = speed;
      progressCurrent = 0;
      self.stop();
    };
    
    this.goToEnd = function Player_goToEnd() {
      currentSpeed = null;
    };
    
    function done() {
      canvas.styleLine(brushStyleBeforePlayback);
      onEnd && onEnd();
      canvas.playing = false;
    }
    
    function setProgressMax() {
      progressMax = 0;
      for (var i=0, action; action=actions[i++];) {
        if (action && action.action && action.action.points) {
          progressMax += action.action.points.length;
        }
      }
    }
    
    // if we don't support showing UNDOs as a step,
    // we change the actions and remove any undo'd drawing action
    function clearUndos() {
      if (DISPLAY_UNDO_AS_STEP) {
        return;
      }
      
      for (var i=0, action; action=actions[i++];) {
        if (action.type === 'undo') {
          // number of actions to remove is from the undo properties + 1 for the undo itself
          var numActionsToUndo = 1 + (action.hasOwnProperty("actions")? action.actions : 1),
            indexToRemoveFrom = Math.max(i - numActionsToUndo, 0);
            
          Utils.log('Undo: clear ' + numActionsToUndo + ' actions at ' + indexToRemoveFrom);
          
          actions.splice(indexToRemoveFrom, numActionsToUndo - (indexToRemoveFrom - (i - numActionsToUndo)));
          i = indexToRemoveFrom;
        }
      }
    }
    
    function loop() {
      var action = actions[iAction],
        actionDone = FUNCTIONS[action.type](action);
      
      if (actionDone) {
        iPoint = 0;
        iAction++;
      }
      
      if (iAction < actions.length) {
        if (currentSpeed) {
          timeoutLoop = window.setTimeout(loop, currentSpeed);
        } else {
          loop();
        }
      } else {
        done();
      }
    }
    
    function handle_draw(action) {
      progressCurrent++;
      
      onProgress && onProgress(progressCurrent, progressMax);
      
      if (!path) {
        points = action.action.points;
        canvas.styleLine(action.action.brush);
        
        path = new Path({
          "canvas": canvas,
          "begin": points[iPoint]
        });
        iPoint++;
      } else {
        if (iPoint < points.length) {
          path.move(points[iPoint]);
          iPoint++;
        } else {
          if (iPoint == 1) {
            path.putPoint(points[0]);
          }
          path.end();
          path = null;
          
          if (DISPLAY_UNDO_AS_STEP) {
            history.push(canvas.getImage());
          }
          
          return true;
        }
      }
      
      return false;
    }
    
    function handle_undo(action) {
      if (history.length > 0) {
        if (history.length == 1) {
          canvas.clear();
        } else {
          var image = history[history.length-2];
          canvas.putImage(image);
        }
        
        history.splice(history.length-1, 1);
      }
      
      return true;
    }
    
    return self;
  };

  window.DrawingPlayer = DrawingPlayer;
}());