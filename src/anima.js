// Anima: A simple CSS transisions helper library
// 
// Anima is designed to enable CSS transitions via a simple JavaScript api.
// This library is designed to support:
//
// 1. Queuing a series of animations
// 2. Running a series of animations concurrently
// 3. Having callbacks at the end of each animation, or an animation frame
// 4. Cancel existing animation queues
// 5. Fallback to simple CSS styles if the browser does not support CSS transitions
//
// Anima 0.3
//
// (c) 2012 Chong Han Chua
//
// Anima may be freely distributed under the MIT license
// http://github.com/johncch/Anima
;(function() {

	var Anima = {};

	// Because we try to be "smart" about animations and keeping a simpler interface
	// for the user, many functions need to be run as asynchronously.This is 
	// because in the case of firefox and not having any set properties,
	// FF will refuse to animate. To allow FF to animate, there needs to be some
	// time between when the initial property is set, and when the new one is set.i
	var async = function(fn) {
		setTimeout(fn, 10);
	};

	var DEBUG = false;
	var debug = function(msg) {
		if (DEBUG && window.console !== undefined) {
			console.log(msg);
		}
	};

	// Test for vendor extension
	var PREFIX = (function() {
		var VENDORS = ["", "webkit", "Moz", "O", "Ms"];
		var div = document.createElement("div");

		for (var i = 0; i < VENDORS.length; i++) {
			var prefix = VENDORS[i];
			div.cssText = "-" + prefix + "-transition-property:opacity;";
			if (typeof div.style[prefix + "TransitionProperty"] != "undefined") {
				return prefix;
			}
		}
		return "none";
	})();

	var CSS3_TRANSITIONS = PREFIX != "none";

	// This is a convenience object so that it generates the correct string constants
	// for each vendor. This is necessary only because of the pain in the ass nature
	// of vendor support.
	var CONSTANTS = (function() {
		var constants = {};
		constants.Transform = PREFIX + "Transform";
		constants.CSSTransform = "-" + PREFIX.toLowerCase() + "-transform";
		constants.TransitionProperty = PREFIX + "TransitionProperty";
		constants.TransitionDuration = PREFIX + "TransitionDuration";
		constants.TransitionDelay = PREFIX + "TransitionDelay";
		constants.TransitionTimingFunction = PREFIX + "TransitionTimingFunction";
		constants.TransitionEnd = (function() {
			switch(PREFIX) {
				case "Moz":
					return "transitionend";
				case "Ms":
					return "MSTransitionEnd";
				default:
					return PREFIX + "TransitionEnd";
			}
		})();
		constants.BackfaceVisibility = PREFIX + "BackfaceVisibility";
		return constants;
	})();

	// The list of currently supported transforms.
	var TRANSFORM_PROPERTIES = ["scale"];
	var CSS_PROPERTIES = ["top", "left", "opacity", "width", "height"];

	Anima.Defaults = {
		Duration: "0.5s",
		Delay: "0",
		TimingFunction : "default"
	};


    /**
     * Parse transitions take a list of supplied options and parse them into a simplified
     * list of objects.
     * @param {Object} options containing key value pair
     * @param {Element} el provided for reference
     * @return - an object containing an array of keys and an object containing css value and properties
     */
	Anima.parseTransitions = function(options, el) {
		var keys = [];
		var styles = {};
		for (var key in options) {
            if (!options.hasOwnProperty(key)) continue;
			if (TRANSFORM_PROPERTIES.indexOf(key) != -1) {
				if (keys.indexOf(CONSTANTS.CSSTransform) == -1)
					keys.push(CONSTANTS.CSSTransform);
				
				if (!styles[CONSTANTS.Transform])
					styles[CONSTANTS.Transform] = [];	
				styles[CONSTANTS.Transform].push(key + "(" + options[key] + ")");

			} else if (CSS_PROPERTIES.indexOf(key) != -1) {
				if (keys.indexOf(key) == -1)
					keys.push(key);
				
				styles[key] = Anima.parseParams(options[key], key, el);
			}
		}

		if (styles[CONSTANTS.Transform]) styles[CONSTANTS.Transform] = styles[CONSTANTS.Transform].join(" ");

		return {
			"keys": keys,
			"styles": styles
		};
	};

	// Takes in a string or number and returns a formatted string
	//
	// @return time - in a format that css understands
	Anima.parseTime = function(time) {
		if (!time) {
			return null;
		} else if (typeof time == "string") {
			if (time.match(/ms$/) || time.match(/s$/)) 
				return time;	
			else {
				return (parseFloat(time) + "s");
			}
		} else {
			return time + "s";
		}
	};

	// Normalize the arguments into the correct form
	Anima.parseArguments = function(el, properties, duration, delay, timingFunction, callback) {
		// normalize for jQuery
		var result = {};
		if (el.element) {
			// This is an argument object
			result.element = el.element;
			result.properties = el.properties;
			result.duration = el.duration;
			result.delay = el.delay;
			result.timingFunction = el.timingFunction;
			result.callback = el.callback;
		} else {
			if (typeof delay == "function") {
				callback = delay;
				delay = undefined;
				timingFunction = undefined;
			} else if (typeof delay == "string") {
				callback = timingFunction;
				timingFunction = delay;	
				delay = undefined;
			} else {
				if (typeof timingFunction == "function") {
					callback = timingFunction;
					timingFunction = undefined;
				}
			}
			result.element = el;
			result.properties = properties;
			result.duration = duration;
			result.delay = delay;
			result.timingFunction = timingFunction;
			result.callback = callback;
		}
		
		result.element = (jQuery && result.element instanceof jQuery) ? result.element.get() : result.element;
		if (result.element.length && result.element.length == 1) {
			result.element = result.element[0];
		}
		return result;
	};



	/**
	 * Takes in a param and parse them to the correct unit based on the css property that it is modifying
     * @param {*} value
     * @param {String} key
     * @param {Element} el for relative measures
	 */
	Anima.parseParams = function(value, key, el) {
		var units, defaultUnit;
		switch(key) {
			case "width":
			case "height":
			case "left":
			case "top":
				units = ["px", "em", "pt"];
				if (typeof value == "string") {
                    // Check for relative modifications
                    if (value.charAt(1) == "=") {
                        var computed = document.defaultView.getComputedStyle(el, null);

                        var curVal = el.style[key] || el.currentStyle[key] || computed.getPropertyValue(key);
                        curVal = parseInt(curVal, 10);
                        var num = parseInt(value.substr(2), 10);
                        var modifier = (value.charAt(0) == "+") ? 1 : -1 ;
                        return (curVal + (num * modifier) ) + "px";
                    }

                    // Check for units specified
					for(var i = 0; i < units.length; i++) {
						var regex = new RegExp("" + units[i] + "$");
						if(value.match(regex)) {
							return value;
						}
					}
                    // Else parse into pixels
					return parseInt(value, 10) + "px";
				} else {
					return value + "px";
				}
				break;
			case "scale":
				return parseFloat(value);
			case "opacity":
				var opacity = parseFloat(value);
				opacity = (opacity > 1) ? 1.0 : opacity;
				opacity = (opacity < 0) ? 0.0 : opacity;
				return opacity;
			default:
				return value;
		}
	};

	// This is the general queue;)
	var operations = [];
	var runners = [];

	// A convenience method that removes the stored runner object.
	var removeRunner = function(obj) {
		for (var i = 0; i < runners.length; i++) {
			if(runners[i] === obj) {
				runners.splice(i, 1);
				debug("removing runner. Remaining runners:");
				debug(runners);
				return;
			}
		}
	};

	// The Animation object. This is the smallest unit in the Anima library. Every 
	// performed animation per object is represented as one Animation unit.
	//
	// Callbacks are asynchronous.
	//
	// How to use:
	// var animation = Anima.Animation(el, properties, duration [, delay] [, timingFunction] [, callback]
	Anima.Animation = function(el, properties, duration, delay, timingFunction, callback) {
		var args = Anima.parseArguments(el, properties, duration, delay, timingFunction, callback);	
		
		this.element = args.element;
        this.properties = args.properties;
        this.duration = args.duration;
        this.delay = args.delay;
        this.timingFunction = args.timingFunction;

		// this.properties = parseResults.styles;
		this.callback = args.callback;
		this.completionHandler = null;

		// This code sets the element with the current CSS property. This is nessary
		// because Firefox requires an origin value otherwise it will not animate
		var computed = document.defaultView.getComputedStyle(this.element, null);
		// for(var i = 0; i < parseResults.keys.length; i++) {
        for (var key in this.properties) {
            if (!this.properties.hasOwnProperty(key)) continue;
			// var key = parseResults.keys[i];
			debug("style: " + this.element.style[key]);
			if (!this.element.style[key]) {
				if (this.element.currentStyle) {
					debug("a: " + this.element.currentStyle[key]);
					this.element.style[key] = this.element.currentStyle[key];
				} else {
					debug("b: " + computed.getPropertyValue(key));
					this.element.style[key] = computed.getPropertyValue(key);
				}
			}
		}
	};


    /**
     * The animation is executed here
     * @param {Function} [_innerCallback]
     */
    Anima.Animation.prototype.run = function(_innerCallback) {

        var parseResults = Anima.parseTransitions(this.properties, this.element);

        this.style = {};
        this.style[CONSTANTS.TransitionProperty] = parseResults.keys.join(", ");
        this.style[CONSTANTS.TransitionDuration] = Anima.parseTime(this.duration) || Anima.Defaults.Duration;
        this.style[CONSTANTS.TransitionDelay] = Anima.parseTime(this.delay) || Anima.Defaults.Delay;
        this.style[CONSTANTS.TransitionTimingFunction] = this.timingFunction || Anima.Defaults.TimingFunction;

		// For the CSS3 transition case, setup the callbacks and properties
		if(CSS3_TRANSITIONS) {
			// Fixes the flickering in Chrome
			// TODO need to figure out how to better integrate
			// this.element.style[CONSTANTS.BackfaceVisibility] = "hidden";

			if (this.callback || _innerCallback) {
				debug("setting up callback for " + CONSTANTS.TransitionEnd);

				var $callback = this.callback;
				var $el = this.element;
				var $style = this.style;

				var completionHandler = function() {
					debug("calling back...");
					$el.removeEventListener(CONSTANTS.TransitionEnd, completionHandler);
					// Remove the animation definition here
					for (var key in $style) {
						$el.style[key] = "";
					}
					
					if($callback) $callback.call($el);
					if(_innerCallback) async(_innerCallback);
				};
				this.completionHandler = completionHandler;
				this.element.addEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
			}

			for (var key in this.style) {
				debug("executing " + key + ": " + this.style[key]);
				this.element.style[key] = this.style[key];
			}	
		} 

		for (var css in parseResults.styles) {
			debug("executing " + css + ": " + parseResults.styles[css]);
			this.element.style[css] = parseResults.styles[css];
		}
		
		// For the non CSS3 transition case, call the callbacks immediately.
		if (!CSS3_TRANSITIONS) {
			if(this.callback) this.callback.call(this.element);
			if(_innerCallback) async(_innerCallback);
		}
	};

	// "Abort" the current animation by removing all listening callbacks. Since
	// animation is handled by CSS transitions, it cannot actually be stopped.
	Anima.Animation.prototype.abort = function() {
		this.element.removeEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
	};
	
	// Finishes the current animation by applying the CSS property immediately
	Anima.Animation.prototype.finish = function(performCallback) {
		performCallback = (performCallback === undefined) ? true : performCallback;
		this.element.removeEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
		for (var key in this.style) {
			this.element.style[key] = "";
		}
		for (var css in this.properties) {
			debug("executing " + css + ": " + this.properties[css]);
			this.element.style[css] = this.properties[css];
		}
		if(performCallback && this.callback) this.callback.call(this.element);
	};



	// A frame is an object that contains multiple operations that are to be executed
	// concurrently.
	Anima.Frame = function(_callback) {
		this.operations = [];
		this.callback = _callback;
	};

	// The frame exposes the same methods as the base object. However, the queue method
	// only adds to the current frame.
	Anima.Frame.prototype.queue = function(el, properties, duration, delay, timingFunction, callback) {
		var args = Anima.parseArguments(el, properties, duration, delay, timingFunction, callback);
		if (args.element.length && args.element.length >= 1) {
			for (var i = 0; i < args.element.length; i++) {
				var _el = args.element[i];
				this.queue(_el, args.properties, args.duration, args.delay, args.timingFunction);
			}
			this.complete(args.callback);
		} else {
			this.operations.push(
				new Anima.Animation(args.element, args.properties, args.duration, args.delay, args.timingFunction, args.callback)		
			);	
		}
		return this;
	};

	// The frame object also exposes a run method. The run method runs all the animations
	// in the frame concurrently
	Anima.Frame.prototype.run = function(runCallback) {
		var opLen = this.operations.length;
		var cbLen = opLen;
		debug("running " + cbLen);
		var frameCallback = this.callback;
		this.runCallback = runCallback;
		var concurrentCB = function() {
			debug("run concurrent callback " + cbLen);
			if ((--cbLen) === 0 && (frameCallback || runCallback)) {
				if (frameCallback)
					frameCallback.call();
				
				if (runCallback) {
					runCallback.call();
				}
			}
		};
		for (var i = 0; i < opLen; i++) {
			var animation = this.operations[i];
			animation.run(concurrentCB);
		}
	};

	// The complete method adds a callback when the animation is complete. One of the
	// reasons this is done is so that the API looks cleaner
	Anima.Frame.prototype.complete = function(callback) {
		this.callback = callback;	
	};

	// Abort all animations in the frame
	Anima.Frame.prototype.abort = function() {
		for (var i = 0; i < this.operations.length; i++) {
			this.operations[i].abort();
		}
	};
	
	// Complete the current sequence of animations immediately
	Anima.Frame.prototype.finish = function(performCallback) {
		performCallback = (performCallback === undefined) ? true : performCallback;
		for (var i = 0; i < this.operations.length; i++) {
			this.operations[i].finish(performCallback);
		}
		if(performCallback && this.runCallback) this.runCallback.call();
	};


	// The runner is an Animation Runner, an object responsible for making sure
	// a series of animations are ran correctly.
	Anima.Runner = function(_operations) {
		this.operations = (_operations instanceof Array) ? _operations : [_operations];
		this.activeOp = null;
	};

	// Runs all the animations in this runner. This method is typically not called
	// by the consumer.
	Anima.Runner.prototype.run = function(_callback) {
		var opLen = this.operations.length;
		var cbLen = opLen;
		var self = this;
		var $operations = this.operations;
		var $activeOp = this.activeOp;
		this.callback = _callback;
		var runnerCallback = function() {
			debug("inside runner callback");
			if(--cbLen === 0) {
				removeRunner(self);
				if(_callback) _callback.call();
			} else {
				var animation = $operations.shift();
				self.activeOp = animation;
				animation.run(runnerCallback);
			}
		};
		runners.push(this);
		var animation = this.operations.shift();
		this.activeOp = animation;
		async(function() { animation.run(runnerCallback); });
	};

	// Aborts the currently running animation and cancels all animations in the
	// queue.
	Anima.Runner.prototype.abort = function() {
		debug("aborting");
		this.operations = [];
		this.activeOp.abort();
		removeRunner(this);
	};

	// Finishes the animation immediately
	Anima.Runner.prototype.finish = function(performCallback) {
		performCallback = (performCallback === undefined) ? true : performCallback;
		this.activeOp.finish(performCallback);
		for (var i = 0; i < this.operations.length; i++) {
			this.operations[i].finish(performCallback);
		}
		if (performCallback && this.callback) this.callback.call(this); 
		removeRunner(this);
	};


	// ## Public APIs

	// The queue function. An animation sequence is defined and then queued. The
	// animation is not played immediately unti the play() function is called.
	Anima.queue = function(el, properties, duration, delay, timingFunction, callback) {
		if (el instanceof Anima.Frame) {
			operations.push(el);
		} else {
			var args = Anima.parseArguments(el, properties, duration, delay, timingFunction, callback);
			if (args.element.length && args.element.length > 1) {
				var frame = new Anima.Frame();
				for (var i = 0; i < args.element.length; i++) {
					var _el = args.element[i];
					frame.queue(_el, args.properties, args.duration, args.delay, args.timingFunction);
				}
				debug(args.callback);
				frame.complete(args.callback);
				operations.push(frame);
			} else {
				operations.push(
					new Anima.Animation(args.element, args.properties, args.duration, args.delay, args.timingFunction, args.callback)
				);	
			}
		}
		return Anima;
	};

	// This is a convenience function to create a frame of animation. It takes in an
	// array of objects:
	//
	// {
	//     element: (Dom Element)
	//     properties: (Object of key value pairs)
	//     duration: (time in s or ms)
	//     delay: (time in s or ms)
	//     timingFunction: (string)
	//     callback: (callback function
	// }
	//
	// @returns the frame object
	Anima.frame = function(_operations, callback) {
		debug("framing");
		_operations = _operations || [];
		var frame = new Anima.Frame();
		for (var i = 0; i < _operations.length; i++) {
			var op = _operations[i];
			frame.queue(op.element, op.properties, op.duration, op.delay, op.timingFunction, op.callback);
		}
		frame.complete(callback);
		operations.push(frame);
		debug(operations);
		return frame;
	};

	// Play all the animations currently in the queue, sequentially. The callback
	// is optional
	Anima.play = function(_callback) {
		var runner = new Anima.Runner(operations);
		operations = [];
		runner.run(_callback);
		return runner; 
	};

	// Plays only one animation in the queue. The callback is optional.
	Anima.step = function(_callback) {
		var animation = operations.shift();
		var runner = new Anima.Runner(animation);
		runner.run(_callback);
		return runner;
	};

	// Plays one animation immediately. This is a convenience method that essentially
	// calls a queue then a step immediately.
	Anima.animate = function(el, properties, duration, delay, timingFunction, callback) {
		Anima.queue(el, properties, duration, delay, timingFunction, callback);
		Anima.step();
	};

	// Aborts all currently running animations.
	// Since this is CSS3 animations, you can't actually stop it halfway. What 
	// this method actually does though is cancelling any queued up animations,
	// and preventing existing handlers from firing.
	Anima.abort = function() {
		for (var i = 0; i < runners.length; i++) {
			runners[i].abort();
		}
	};

    /**
     * Finishes the current animation sequence immediately, i.e. apply all the
     * CSS properties immediately and performs all callbacks if performCallback
     * is not set to false
     * @param {Function} performCallback
     */
	Anima.finish = function(performCallback) {
		performCallback = (performCallback === undefined) ? true : performCallback;
		for (var i = 0; i < runners.length; i++) {
			runners[i].finish(performCallback);
		}
	};

    /**
     * Helper function to set CSS properties onto elements. The reason for the existance
     * of this function to supplement jQuery css methods since it doesn't normalize for
     * all browsers. Most of the time, before an animation, we would want to reset certain
     * css values and there is currently no easy way to do this.
     * @param {Object} element
     * @param {Object} properties
     */
    Anima.css = function(element, properties) {
        // Normalize
        var _element = (jQuery && element instanceof jQuery) ? element.get() : element;
        if (_element.length && _element.length == 1) {
            _element = _element[0];
        }
        var parseResults = Anima.parseTransitions(properties, _element);
        for (var css in parseResults.styles) {
            debug("executing " + css + ": " + parseResults.styles[css]);
            _element.style[css] = parseResults.styles[css];
        }
    };

	this.Anima = Anima;
})(this);
