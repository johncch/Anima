// Anima: a simple CSS3 animations library
// 
// Anima is designed to enable CSS3 animations via a simple JavaScript api.
// This library is designed to support the following
// 1. Extensive callback support - every animation on an element supports callback
// 2. Concurrent and synchronous support - Animations can be queued and executed
//         or executed as a frame
// 3. TODO fallback to no animations
// 
// Currently this library is tested on Chrome and Firefox, support for other browsers
// will come in as I test them.
//
// author: Chong Han Chua
// License: BSD
var Anima = (typeof Anima == "undefined") ? {} : Anima;

// Test for vendor extension
Anima.Prefix = (function() {
	var VENDORS = ["webkit", "Moz", "O", "ms"];
	var div = document.createElement("div");
	var Prefix;

	for (var i = 0; i < VENDORS.length; i++) {
		Prefix = VENDORS[i];
		div.cssText = "-" + Prefix + "-transition-property:opacity;";
		if (typeof div.style[Prefix + "TransitionProperty"] != "undefined") {
			return Prefix;
		}
	}
	return Prefix;
})();

// This is a convenience object so that it generates the correct string constants
// for each vendor. This is necessary only because of the pain in the ass nature
// of vendor support.
Anima.Constants = (function() {
	var constants = {};
	constants.Transform = Anima.Prefix + "Transform";
	constants.CSSTransform = "-" + Anima.Prefix.toLowerCase() + "-transform";
	constants.TransitionProperty = Anima.Prefix + "TransitionProperty";
	constants.TransitionDuration = Anima.Prefix + "TransitionDuration";
	constants.TransitionDelay = Anima.Prefix + "TransitionDelay";
	constants.TransitionEnd = (function() {
		switch(Anima.Prefix) {
			case "Moz":
				return "transitionend";
			case "ms":
				return "MSTransitionEnd";
			default:
				return Anima.Prefix + "TransitionEnd";
		}
	})();
	return constants;
})();

// The list of currently supported transforms.
Anima.TransformProperties = ["scale"];
Anima.CSSProperties = ["top", "left", "opacity"];

// Parse transitions take a list of supplied options and parse them into a simplified
// list of objects.
//
// @return - an object containing an array of keys and an object containing css 
//     value and properties
Anima.parseTransitions = function(options) {
	var keys = [];
	var styles = {};
	for (var key in options) {
		if (Anima.TransformProperties.indexOf(key) != -1) {
			if (keys.indexOf(Anima.Constants.CSSTransform) == -1)
				keys.push(Anima.Constants.CSSTransform);
			
			if (!styles[Anima.Constants.Transform])
				styles[Anima.Constants.Transform] = [];	
			styles[Anima.Constants.Transform].push(key + "(" + options[key] + ")");

		} else if (Anima.CSSProperties.indexOf(key) != -1) {
			if (keys.indexOf(key) == -1)
				keys.push(key);
			
			styles[key] = Anima.parseParams(options[key], key);
		}
	}

	if (styles[Anima.Constants.Transform]) styles[Anima.Constants.Transform] = styles[Anima.Constants.Transform].join(" ");

	return {
		"keys": keys,
		"styles": styles
	};
};

// @return time - in a format that css understands
Anima.parseTime = function(time, def) {
	if (typeof time == "undefined") {
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

Anima.parseParams = function(value, key) {
	var units, defaultUnit;
	switch(key) {
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
	this.style[Anima.Constants.TransitionProperty] = parseResults.keys.join(", ");
	this.style[Anima.Constants.TransitionDuration] = Anima.parseTime(duration, "1.0s");
	this.style[Anima.Constants.TransitionDelay] = Anima.parseTime(delay, 0);

	this.properties = parseResults.styles;
	
	this.callback = callback;
	
	// This code sets the element with the current CSS property. This is nessary
	// because Firefox requires an origin value otherwise it will not animate
	for(var i = 0; i < parseResults.keys.length; i++) {
		var key = parseResults.keys[i];
		var d = document.defaultView.getComputedStyle(this.element, null).getPropertyValue(key);	
		console.log(key + ", " + d);
		this.element.style[key] = d; 
	}
};


// This is where the animation is actually executed
Anima.Animation.prototype.run = function(_innerCallback) {
	for (var key in this.style) {
		console.log("executing " + key + ": " + this.style[key]);
		this.element.style[key] = this.style[key];
	}

	for (var css in this.properties) {
		console.log("executing " + css + ": " + this.properties[css]);
		this.element.style[css] = this.properties[css];
	}
	
	if (this.callback || _innerCallback) {
		console.log("setting up callback for " + Anima.Constants.TransitionEnd);
		
		var _callback = this.callback;
		
		var _el = this.element;
		var callbackHandler = function() {
			_el.removeEventListener(Anima.Constants.TransitionEnd, callbackHandler);
			// Remove the animation definition here
			_el.style[Anima.Constants.TransitionProperty] = "";
			_el.style[Anima.Constants.TransitionDuration] = "";
			_el.style[Anima.Constants.TransitionDelay] = "";
			if(_callback) _callback();
			if(_innerCallback) setTimeout(_innerCallback, 0);
		};
		this.element.addEventListener(Anima.Constants.TransitionEnd, callbackHandler);
	}
};


Anima.Frame = function(callback) {
	this.operations = [];
	this.callback = callback;
};

Anima.Frame.prototype.queue = function(el, options, duration, delay, callback) {
	this.operations.push(
		new Anima.Animation(el, options, duration, delay, callback)		
	);
};

Anima.Frame.prototype.run = function(runCallback) {
	var opLen = this.operations.length;
	var cbLen = opLen;
	var frameCallback = this.callback;
	var concurrentCB = function() {
		if ((--cbLen) === 0 && (frameCallback || runCallback)) {
			if (frameCallback) {
				frameCallback();
			}
			if (runCallback) {
				setTimeout(function() {
					runCallback();
				}, 20);
			}
		}
	};
	for (var i = 0; i < opLen; i++) {
		var animation = this.operations.shift();
		animation.run(concurrentCB);
	}
};


// This is the general queue;
Anima.operations = [];

Anima.queue = function(el, options, duration, delay, callback) {
	if (el instanceof Anima.Frame) {
		Anima.operations.push(el);
	} else {
		Anima.operations.push(
				new Anima.Animation(el, options, duration, delay, callback)
				);	
	}
	return Anima;
};

Anima.play = function() {
	console.log("running");
	var animations = Anima.operations;
	Anima.operations = [];
	(function next() {
		if(animations.length === 0) return;
		var animation = animations.shift();
		animation.run(next);
	})();
};

Anima.concurrent = function(callback) {
	var opLen = Anima.operations.length;
	var cbLen = opLen;
	var concurrentCB = function() {
		if ((--cbLen) === 0 && callback)	callback.call(this);
	};
	for (var i = 0; i < opLen; i++) {
		var animation = Anima.operations.shift();
		animation.run(concurrentCB);
	}
};

Anima.step = function(callback) {
	if (Anima.operations.length === 0) return;
	var animation = Anima.operations.shift();
	console.log(animation);
	animation.run(callback);
};

Anima.animate = function(el, options, duration, delay, callback) {
	Anima.queue(el, options, duration, delay, callback);
	Anima.step();
};
