(function(){
  'use strict';
  
  function Drawing(config) {
    var self = this,
      id = "", name = "", meta = "", lastUpdated = "", type = "",
      actions = [], player = null, canvas = null, removed = false, touchHandler,
      requestSave = null, requestUpdate = null, lastSavedAction = 0, timeoutUpdate = null, timeoutSave = null,
      
      SAVE_THRESHOLD_TIME = 400,
      MAX_ACTIONS_QUEUE = 4;
      
    this.init = function Drawing_init(options) {
      actions = options.actions || [];
      id = options.id;
      
      type = options.type;
      

      var elContainer = options.elContainer;
      canvas = new Canvas({
        "width": options.width || elContainer.offsetWidth,
        "height": options.height || elContainer.offsetWidth,
        "zIndex": options.zIndex
      });
         
      elContainer.appendChild(canvas.get());
      
      if (options.elProgressParent) {
        self.Progress.init(options.elProgressParent);
      }
      
      if (type === "load") {
        self.update();
      }
      
      player = new DrawingPlayer({
        "canvas": canvas,
        "clear": true,
        "actions": actions,
        "speed": (type === "load")? 10 : 0,
        "onStart": onPlayerStart,
        "onEnd": onPlayerEnd,
        "onProgress": onPlayerProgress
      });

      touchHandler = new TouchHandler({
        "$el": elContainer,
        "canvas": canvas,
        "cancelBodyMove": true,
        "path": {
            "timeBeforePuttingPoint": 3000,
            "maxTimeToDrawPoint": 200
        },
        "onStart": function(point){
          
        },
        "onMove": function(point){
          
        },
        "onEnd": function(points) {
            if (points.length === 0) {
                return;
            }

            var actionsSinceHistorySaved = [];
            actionsSinceHistorySaved.push({
                "type": "draw",
                "action": {
                    "points": points
                }
            });
        }
    });
    };
    
    this.isSaved = function Drawing_isSaved() {
      return !!id;
    };
    
    this.getName = function Drawing_getName() { return name; };
    this.getId = function Drawing_getId() { return id; };
    this.getCanvas = function Drawing_getCanvas() { return canvas; };
    this.getPlayer = function Drawing_getPlayer() { return player; };
    this.getActions = function Drawing_getActions(bRemoveUndos) {
      if (!bRemoveUndos){
        return actions;
      }
      
      var filteredActions = actions.slice(0);
      for (var i=0, action; action=filteredActions[i++];) {
        if (action.type === 'undo') {
          var numActionsToUndo = 1 + (action.hasOwnProperty("actions")? action.actions : 1);
          filteredActions.splice(i - numActionsToUndo, numActionsToUndo);
          i = i-numActionsToUndo;
        }
      }
      return filteredActions;
    };
    
    this.setSize = function Drawing_setSize(width, height) {
      canvas.setSize(width, height);
      player.start();
    };
    
    this.play = function Drawing_play() {
      player.start();
    };
    
    this.goToStart = function Drawing_goToStart() {
      player.goToStart();
    };
    
    this.goToEnd = function Drawing_skipToEnd() {
      player.goToEnd();
    };
    
    this.clear = function Drawing_clear() {
      removed = true;
      window.clearTimeout(timeoutUpdate);
      requestSave && requestSave.abort();
      requestUpdate && requestUpdate.abort();
      actions = [];
      canvas.clear();
    };
    
    this.remove = function Drawing_remove() {
      self.clear();
      canvas.remove();
    };
  
    this.add = function Drawing_add(actionsToAdd) {
      actions = actions.concat(actionsToAdd);
      
      player.add(actionsToAdd, (type === "load"));
    };
    
    this.setName = function Drawing_setName(newName) {
      name = newName;
    };
    
    this.save = function Drawing_save(callback) {
      var currentActionsCount = actions.length,
        actionsToSave = actions.slice(lastSavedAction),
        meta = null;
      
      if (!name) {
        return;
      }
      if (requestSave) {
        return;
      }
    
      if (currentActionsCount === lastSavedAction) {
        return;
      }
      
      if (actionsToSave.length === 0) {
        actionsToSave = "";
      } else {
        actionsToSave = JSON.stringify(actionsToSave);
      }
      
      meta = JSON.stringify({
        "name": name,
        "width": canvas.getWidth(),
        "height": canvas.getHeight()
      });
      
      requestSave = DB.Drawing.save({
        "drawingId": id || "",
        "actions": actionsToSave,
        "meta": meta
      }, function onSuccess(data) {
        if (!data || !data.response) {
          return;
        }
        
        var response = data.response;
        if (response.error) {
          
        } else {
          id = response;
          
          lastSavedAction = currentActionsCount;
          
          callback && callback(id);
        }
        
        requestSave = null;
      });
    };
    
    this.update = function Drawing_update() {
      if (!id) {
        return;
      }
      
      window.clearTimeout(timeoutUpdate);
      requestUpdate && requestUpdate.abort();
      requestSave = DB.Drawing.actions({
        "drawingId": id,
        "updated": lastUpdated
      }, updateCallback);
    };
    
    this.disable = function Drawing_disable() {
      
    };
    
    function updateCallback(data) {
      var newActions = data.response.actions,
        actionsToDo = [];
      
      window.clearTimeout(timeoutUpdate);
      
      if (newActions && newActions.length > 0) {
        for (var i=0; i<newActions.length; i++) {
          newActions[i].action = JSON.parse(newActions[i].action);
          actionsToDo = actionsToDo.concat(newActions[i].action);
        }
        
        lastUpdated = newActions[newActions.length-1].dateAdded;
        self.add(actionsToDo);
      }
      
      requestUpdate = null;
    }
    
    function onPlayerStart() {
      requestUpdate && requestUpdate.abort();
      window.clearTimeout(timeoutUpdate);
      self.Progress.start();
    }
    
    function onPlayerEnd() {
      self.Progress.end();
    }
    
    function onPlayerProgress(current, max) {
      self.Progress.update(current/max);
    }
    
    this.Progress = {
      el: null,
      elProgress: null,
      active: false,
      property: '',
      
      init: function(elParent) {
        this.el = document.createElement('div');
        this.elProgress = document.createElement('span');
        this.el.className = 'progress';
        
        this.property = 'transform';
        this.style = this.elProgress.style;
        
        this.el.appendChild(this.elProgress);
        
        elParent.appendChild(this.el);
        
        this.active = true;
      },
      update: function(percent) {
        if (this.active) {
          this.style[this.property] = 'scale(' + percent.toFixed(2) + ', 1) translateY(0)';
        }
      },
      start: function() {
        this.el.classList.remove('hide');
        this.update(0);
      },
      end: function() {
        this.el.classList.add('hide');
        this.update(1);
      }
    };
    
    function createProgress() {
      
    }
    
    config && self.init(config);
  }
  
  window.Drawing = Drawing;
}());