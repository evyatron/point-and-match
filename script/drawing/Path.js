(function(){
    'use strict';
    
    function Path(config) {
        var self = this,
            canvas = config.canvas,
            startPoint = [], points = [], addedStartPoint = false,
            timeStarted = 0, timeoutPoint = null,
            
            TIMEOUT_BEFORE_PUTTING_POINT = config.timeBeforePuttingPoint,
            TIME_FOR_POINT = config.maxTimeToDrawPoint;
            
        this.begin = function Path_begin(point) {
            points = [];
            timeStarted = new Date().getTime();
            startPoint = point;
            addedStartPoint = false;
            
            canvas.startLine(point);
            
            if (TIMEOUT_BEFORE_PUTTING_POINT) {
                timeoutPoint = window.setTimeout(function onTimeout() {
                    self.putPoint(point);
                    timeoutPoint = null;
                }, TIMEOUT_BEFORE_PUTTING_POINT);
            }
        };
        
        this.move = function Path_move(point) {
            canvas.drawLine(point);
            
            if (!addedStartPoint && timeoutPoint) {
                addedStartPoint = true;
                points.push(startPoint);
            }
            window.clearTimeout(timeoutPoint);
            
            points.push(point);
        };
        
        this.end = function Path_end() {
            if (TIME_FOR_POINT) {
                if (points.length === 0 && new Date().getTime() - timeStarted < TIME_FOR_POINT) {
                    self.putPoint(startPoint);
                }
            }
            window.clearTimeout(timeoutPoint);
            
            canvas.endLine();
        };
        
        this.putPoint = function Path_putPoint(point) {
            points.push(point);
            
            canvas.drawPoint(point);
        };
        
        this.getPoints = function Path_getPoints() {
            return points;
        };
        
        config.begin && self.begin(config.begin);
    }
    
    window.Path = Path;
}());