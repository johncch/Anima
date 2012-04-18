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
// Anima 0.2
//
// (c) 2012 Chong Han Chua
//
// Anima may be freely distributed under the MIT license
// http://github.com/johncch/Anima
var Anima = (function() {

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
	CONSTANTS = (function() {
		var constants = {};
		constants.Transform = PREFIX + "Transform";
		constants.CSSTransform = "-" + PREFIX.toLowerCase() + "-transform";
		constants.TransitionProperty = PREFIX + "TransitionProperty";
		constants.TransitionDuration = PREFIX + "TransitionDuration";
		constants.TransitionDelay = PREFIX + "TransitionDelay";
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

	// Parse transitions take a list of supplied options and parse them into a simplified
	// list of objects.
	//
	// @return - an object containing an array of keys and an object containing css 
	//     value and properties
	Anima.parseTransitions = function(options) {
		var keys = [];
		var styles = {};
		for (var key in options) {
			if (TRANSFORM_PROPERTIES.indexOf(key) != -1) {
				if (keys.indexOf(CONSTANTS.CSSTransform) == -1)
					keys.push(CONSTANTS.CSSTransform);
				
				if (!styles[CONSTANTS.Transform])
					styles[CONSTANTS.Transform] = [];	
				styles[CONSTANTS.Transform].push(key + "(" + options[key] + ")");

			} else if (CSS_PROPERTIES.indexOf(key) != -1) {
				if (keys.indexOf(key) == -1)
					keys.push(key);
				
				styles[key] = Anima.parseParams(options[key], key);
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
	Anima.parseTime = function(time, def) {
		if (!time) {
			return def;
		} else if (typeof time == "string") {
			if (time.match(/ms$/) || time.match(/s$/)) 
				return time;	
			else {
				return parseFloat(time) + "s";
			}
		} else {
			return time + "s";
		}
	};


	// Takes in a param and parse them to the correct unit based on the css property
	// that it is modifying
	Anima.parseParams = function(value, key) {
		var units, defaultUnit;
		switch(key) {
			case "width":
			case "height":
			case "left":
			case "top":
				units = ["px", "em", "pt"];
				if (typeof value == "string") {
					for(var i = 0; i < units.length; i++) {
						var regex = new RegExp("" + units[i] + "$");
						if(value.match(regex)) {
							return value;
						}
					}
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

	// This is the general queue;
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
	// var animation = Anima.animation(el, properties, duration [, delay] [, callback]
	Anima.Animation = function(el, properties, duration, delay, callback) {
		// normalize for jQuery
		this.element = (el instanceof jQuery) ? el[0] : el;
		if (typeof delay == "function") {
			callback = delay;
			delay = 0;
		}
		
		var parseResults = Anima.parseTransitions(properties);

		this.style = {};
		this.style[CONSTANTS.TransitionProperty] = parseResults.keys.join(", ");
		this.style[CONSTANTS.TransitionDuration] = Anima.parseTime(duration, "1.0s");
		this.style[CONSTANTS.TransitionDelay] = Anima.parseTime(delay, 0);

		this.properties = parseResults.styles;
		this.callback = callback;
		this.completionHandler = null;

		// This code sets the element with the current CSS property. This is nessary
		// because Firefox requires an origin value otherwise it will not animate
		var computed = document.defaultView.getComputedStyle(this.element, null);
		for(var i = 0; i < parseResults.keys.length; i++) {
			var key = parseResults.keys[i];
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


	// This is where the animation is actually executed
	Anima.Animation.prototype.run = function(_innerCallback) {

		// For the CSS3 transition case, setup the callbacks and properties
		if(CSS3_TRANSITIONS) {
			// Fixes the flickering in Chrome
			// TODO need to figure out how to better integrate
			this.element.style[CONSTANTS.BackfaceVisibility] = "hidden";

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

		for (var css in this.properties) {
			debug("executing " + css + ": " + this.properties[css]);
			this.element.style[css] = this.properties[css];
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



	// A frame is an object that contains multiple operations that are to be executed
	// concurrently.
	Anima.Frame = function(_callback) {
		this.operations = [];
		this.callback = _callback;
	};

	// The frame exposes the same methods as the base object. However, the queue method
	// only adds to the current frame.
	Anima.Frame.prototype.queue = function(el, options, duration, delay, callback) {
		if (el.length && el.length > 1) {
			debug(typeof delay);
			if (typeof delay == "function") {
				callback = delay;
				delay = null;
			}
			for (var i = 0; i < el.length; i++) {
				var _el = el[i];
				this.queue(_el, options, duration, delay);
			}
			this.complete(callback);
		} else {
			this.operations.push(
				new Anima.Animation(el, options, duration, delay, callback)		
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


	// ## Public APIs

	// The queue function. An animation sequence is defined and then queued. The
	// animation is not played immediately unti the play() function is called.
	Anima.queue = function(el, options, duration, delay, callback) {
		if (el instanceof Anima.Frame) {
			operations.push(el);
		} else {
			if (el.length && el.length > 1) {
				debug(typeof delay);
				if (typeof delay == "function") {
					callback = delay;
					delay = null;
				}
				var frame = new Anima.Frame();
				for (var i = 0; i < el.length; i++) {
					var _el = el[i];
					frame.queue(_el, options, duration, delay);
				}
				debug(callback);
				frame.complete(callback);
				operations.push(frame);
			} else {
				operations.push(
					new Anima.Animation(el, options, duration, delay, callback)
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
	//     callback: (callback function
	// }
	//
	// @returns the frame object
	Anima.frame = function(_operations, callback) {
		debug("framing");
		var frame = new Anima.Frame();
		for (var i = 0; i < _operations.length; i++) {
			var op = _operations[i];
			frame.queue(op.element, op.properties, op.duration, op.delay, op.callback);
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
	Anima.animate = function(el, options, duration, delay, callback) {
		Anima.queue(el, options, duration, delay, callback);
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

	return Anima;
})();
