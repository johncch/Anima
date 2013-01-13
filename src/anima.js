/**
 * Anima: A simple CSS transisions helper library
 * 
 * Anima is designed to enable CSS transitions via a simple JavaScript api.
 * This library is designed to support:
 *
 * 1. Queuing a series of animations
 * 2. Running a series of animations concurrently
 * 3. Having callbacks at the end of each animation, or an animation frame
 * 4. Cancel existing animation queues
 * 5. Fallback to simple CSS styles if the browser does not support CSS transitions
 *
 * Anima 0.4
 *
 * @preserve (c) 2012-3 Chong Han Chua <johncch@outlook.com>
 * Anima may be freely distributed under the MIT license
 * http://github.com/johncch/Anima
 */
;(function() {

	var Anima = {};

	// Because we try to be "smart" about animations and keeping a simpler interface
	// for the user, many functions need to be run as asynchronously.This is 
	// because in the case of firefox and not having any set properties,
	// FF will refuse to animate. To allow FF to animate, there needs to be some
	// time between when the initial property is set, and when the new one is set.i
	var async = function(fn) {
		setTimeout(fn);
	};

	var DEBUG = false;
    var MAX_LAPSE_DUR = 100;

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
	// Modify here to add new properties
	var TRANSFORM_PROPERTIES = ["scale"];
	var CSS_PROPERTIES = ["top", "bottom", "left", "right", "opacity", "width", "height"];

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
     * @return {Object} - an object containing an array of keys and an object containing css value and properties
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

		return { "keys": keys, "styles": styles };
	};

    /**
     * Takes in a string or number and returns a formatted string
     * @param {*} time
     * @return {String} in a time format that css understands
     **/
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

	
	function CSSTimeToMs(time) {
		console.log(typeof time);
		if (typeof time == "string") {
			if (time.match(/ms$/)) {
				return parseInt(time);
			} else if (time.match(/s$/)) {
				return parseFloat(time) * 1000;
			}
			return parseInt(time)
		}
		return time;
	}

	/**
	 * Normalize the arguments into the correct form
	 * @param {Object} el can be a properties object, or the element itself
	 * @param {Object} [properties]
	 * @param {String|Number} [duration]
	 * @param {String|Number} [delay]
	 * @param {String} [timingFunction]
	 * @param {Function} [callback]
	 */
	Anima.parseArguments = function(el, properties, duration, delay, timingFunction, callback) {
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
				DEBUG && console.log("[Anima] Removing runner. Remaining runners:");
				DEBUG && console.log(runners);
				return;
			}
		}
	};

    /**
     * The Animation object. This is the smallest unit in the Anima library. Every
     * performed animation per object is represented as one Animation unit.
     *
     * var animation = Anima.Animation(el, properties, duration [, delay] [, timingFunction] [, callback]
     *
     * @param el
     * @param properties
     * @param duration
     * @param [delay]
     * @param [timingFunction]
     * @param [callback]
     * @constructor
     */
	Anima.Animation = function(el, properties, duration, delay, timingFunction, callback) {
		var args = Anima.parseArguments(el, properties, duration, delay, timingFunction, callback);	
		
		this.element = args.element;
        this.properties = args.properties;
        this.duration = args.duration;
        this.delay = args.delay;
        this.timingFunction = args.timingFunction;
		this.callback = args.callback;
		this.completionHandler = null;

		// This code sets the element with the current CSS property. This is necessary
		// because Firefox requires an origin value otherwise it will not animate
		var computed = document.defaultView.getComputedStyle(this.element, null);
        for (var key in this.properties) {
            if (!this.properties.hasOwnProperty(key)) continue;
			if (!this.element.style[key]) {
				if (this.element.currentStyle) {
					this.element.style[key] = this.element.currentStyle[key];
				} else {
					this.element.style[key] = computed.getPropertyValue(key);
				}
			}
		}
	};

    /**
     * The animation is executed here
     * @param {Function} [innerCallback]
     */
    Anima.Animation.prototype.run = function(innerCallback) {
        DEBUG && console.log("[Anima] (Animation) Running animation");
        var transitions = this.transitions = Anima.parseTransitions(this.properties, this.element);

        this.style = {};
        this.style[CONSTANTS.TransitionProperty] = transitions.keys.join(", ");

        var duration = Anima.parseTime(this.duration) || Anima.Defaults.Duration;
        this.style[CONSTANTS.TransitionDuration] = duration;

        var delay = Anima.parseTime(this.delay) || Anima.Defaults.Delay;
        this.style[CONSTANTS.TransitionDelay] = delay;

        this.style[CONSTANTS.TransitionTimingFunction] = this.timingFunction || Anima.Defaults.TimingFunction;

		// For the CSS3 transition case, setup the callbacks and properties
		if (CSS3_TRANSITIONS) {
			if (this.callback || innerCallback) {
				// DEBUG && console.log("setting up callback for " + CONSTANTS.TransitionEnd);
				var callback = this.callback,
				    el = this.element,
				    style = this.style,
                    totalTime = CSSTimeToMs(duration) + CSSTimeToMs(delay) + MAX_LAPSE_DUR,
					self = this;

				var completionHandler = this.completionHandler = function() {
					DEBUG && console.log("[Anima] (Animation) Animation completed");
                    clearTimeout(self.timeout);
					el.removeEventListener(CONSTANTS.TransitionEnd, completionHandler);
					// Remove the animation definition here
					for (var key in style) {
                        if (style.hasOwnProperty(key)) {
                            el.style[key] = "";
                        }
					}
					if(callback) callback.call(el);
					if(innerCallback) async(innerCallback);
				};

				this.element.addEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
                this.timeout = setTimeout(function() { completionHandler(); }, totalTime);
			}

			for (var key in this.style) {
				if (this.style.hasOwnProperty(key)) {
                    this.element.style[key] = this.style[key];
                }
			}	
		} 

		for (var css in transitions.styles) {
			if (transitions.styles.hasOwnProperty(css)) {
                this.element.style[css] = transitions.styles[css];
            }
		}
		
		// For the non CSS3 transition case, call the callbacks immediately.
		if (!CSS3_TRANSITIONS) {
			if(this.callback) this.callback.call(this.element);
			if(innerCallback) async(innerCallback);
		}
	};

    /**
     * "Abort" the current animation by removing all listening callbacks. Since
     * animation is handled by CSS transitions, it cannot actually be stopped.
     */
	Anima.Animation.prototype.abort = function() {
		clearTimeout(this.timeout);
		this.element.removeEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
	};

    /**
     * Finishes the current animation by applying the CSS property immediately
     * @param {Boolean} performCallback
     */
	Anima.Animation.prototype.finish = function(performCallback) {
		performCallback = (performCallback === undefined) ? true : performCallback;
		clearTimeout(this.timeout);
		this.element.removeEventListener(CONSTANTS.TransitionEnd, this.completionHandler);
		for (var key in this.style) {
			this.element.style[key] = "";
		}
		Anima.css(this.element, this.properties);
		if(performCallback && this.callback) this.callback.call(this.element);
	};

    /**
     * A frame is an object that contains multiple operations that are to be executed
     * @param {Function} [callback]
     * @constructor
     */
	Anima.Frame = function(callback) {
		this.operations = [];
		this.callback = callback;
	};

    /**
     * The frame exposes the same methods as the base object. However, the queue method only adds to the current frame.
     * @param el
     * @param properties
     * @param duration
     * @param delay
     * @param timingFunction
     * @param callback
     * @return {Anima.Frame}
     */
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

    /**
     * The frame object also exposes a run method. The run method runs all the animations
     * in the frame concurrently
     * @param {Function} [runCallback]
     */
	Anima.Frame.prototype.run = function(runCallback) {
		var opLen = this.operations.length,
            frameCallback = this.callback;
		DEBUG && console.log("[Anima] (Frame) running %d animations concurrently", opLen);

		this.runCallback = runCallback;
		var concurrentCB = function() {
			DEBUG && console.log("[Anima] (Frame) Callback at length %d", opLen);
			if ((--opLen) === 0) {
				if (frameCallback) {
                    frameCallback.call();
                }
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

    /**
     * The complete method adds a callback when the animation is complete. One of the
     * reasons this is done is so that the API looks cleaner
     * @deprecated
     */
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


    /**
     * A helper class to run animations. The runner takes an array of operations, and
     * run them sequentially
     * @param {Array} operations
     * @constructor
     */
	Anima.Runner = function(operations) {
		this.operations = (operations instanceof Array) ? operations : [operations];
		this.activeOp = null;
	};

    /**
     * Runs all the operations in the operations array
     * @param {Function} [callback]
     */
	Anima.Runner.prototype.run = function(callback) {
        var self = this,
		    cbLen = this.operations.length;
		this.callback = callback;

		function runnerCallback() {
            DEBUG && console.log("[Anima] (Runner) Callback with cbLen %d", cbLen);
			if(--cbLen === 0) {
				removeRunner(self);
				if(callback) callback.call();
			} else {
				var animation = self.operations.shift();
				self.activeOp = animation;
				animation.run(runnerCallback);
			}
		}

        DEBUG && console.log("[Anima] (Runner) Start of run");
        runners.push(this);
        DEBUG && console.log("[Anima] (Runner) Number of runners");
        DEBUG && console.log(runners);
		var animation = this.operations.shift();
		this.activeOp = animation;

		async(function() { animation.run(runnerCallback); });
	};

    /**
     * Aborts the currently running animation and cancels all animations in the queue
     */
	Anima.Runner.prototype.abort = function() {
		DEBUG && console.log("[Anima] (Runner) Aborting");
		this.operations = [];
		this.activeOp.abort();
		removeRunner(this);
	};

	/**
	 * Finishes the animation immediately
	 * @param {Boolean} [performCallback]
	 */
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

	/**
	 * The queue function. An animation sequence is defined and then queued. The
	 * animation is not played immediately unti the play() function is called.
	 */
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
				DEBUG && console.log(args.callback);
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

	/**
	 * This is a convenience function to create a frame of animation. It takes in an
	 * array of objects:
	 *
	 * {
	 *     element: (Dom Element)
	 *     properties: (Object of key value pairs)
	 *     duration: (time in s or ms)
	 *     delay: (time in s or ms)
	 *     timingFunction: (string)
	 *     callback: (callback function
	 * }
	 *
	 * @returns the frame object
	 */
	Anima.frame = function(_operations, callback) {
		_operations = _operations || [];
		var frame = new Anima.Frame();
		for (var i = 0; i < _operations.length; i++) {
			var op = _operations[i];
			frame.queue(op.element, op.properties, op.duration, op.delay, op.timingFunction, op.callback);
		}
		frame.complete(callback);
		operations.push(frame);
		// DEBUG && console.log(operations);
		return frame;
	};

	/**
	 * Play all the animations currently in the queue, sequentially. The callback
	 * is optional
	 * @param {Function} [callback]
	 */	 
	Anima.play = function(callback) {
		var runner = new Anima.Runner(operations);
		operations = [];
		runner.run(callback);
		return runner; 
	};

	/**
	 * Plays only one animation in the queue.
	 * @param {Function} [callback]
	 */
	Anima.step = function(callback) {
        var animation = operations.shift(),
		    runner = new Anima.Runner(animation);
		runner.run(callback);
		return runner;
	};

	/**
	 * Plays one animation immediately. This is a convenience method that essentially
	 * calls a queue then a step immediately.
	 * @param {Object} el can be a properties object, or the element itself
	 * @param {Object} [properties]
	 * @param {String|Number} [duration]
	 * @param {String|Number} [delay]
	 * @param {String} [timingFunction]
	 * @param {Function} [callback]
	 */
	Anima.animate = function(el, properties, duration, delay, timingFunction, callback) {
		Anima.queue(el, properties, duration, delay, timingFunction, callback);
		Anima.step();
	};

	/**
	 * Aborts all currently running animations.
	 * Since this is CSS3 animations, you can't actually stop it halfway. What 
	 * this method actually does though is cancelling any queued up animations,
	 * and preventing existing handlers from firing.
	 */
	Anima.abort = function() {
		for (var i = 0; i < runners.length; i++) {
			runners[i].abort();
		}
	};

    /**
     * Finishes the current animation sequence immediately, i.e. apply all the
     * CSS properties immediately and performs all callbacks if performCallback
     * is not set to false
     * @param {Boolean} performCallback
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
            // DEBUG && console.log("executing " + css + ": " + parseResults.styles[css]);
            _element.style[css] = parseResults.styles[css];
        }
    };

	this.Anima = Anima;
})(this);
