# Anima
A tiny CSS library for animating DOM elements using CSS transitions.                               

## Installation
Download the javascript and include it in your header

    <script src="anima.js" type="text/javascript"></script>
    
## Features
Anima was created to solve the following problems

* Applying multiple animations sequentially
* Applying CSS transitions in a clean manner
* Callbacks to CSS transitions in an efficient manner (display none after opacity is set to 0 for example)
* Callbacks after a series of transitions with varying times
* And generally getting out of your way when coding a JavaScript Application

A good use of this library would be on click handlers or state changes in a JS application.

Anima will be battle tested in socialist. All contribution and critique is welcome.

## Quickstart

Anima has the concept of an animation frame and animation unit. An animation unit is a desired transition that is to be applied on a HTML element. An animation unit can be added as follows:

    Anima.queue(element, {
        left: 10,
        opacity: 0
    }, 0.4, function() {
        console.log("completed animation!");
    });
    
The animation is then added to the global queue. This however does not play the animation. To play the transition,

    Anima.play();
    
Anima now supports an alternate object notation

    Anima.queue({
		element: el,
		properties: {
			"left": 10
		},
		duration: 10,
		delay: 0,
		timingFunction: "linear",
		callback: function() {
			// do something
		}
	});

Remember that all animations are queued up until the play function is called. If you call queue multiple times, each animation is add to the end of the queue. When the `play()` function is called, they will run sequentially.

To run animations concurrently, Anima introduces the concept of a frame:

    var frame = new Anima.Frame();
    frame.queue(element, {
        left: 10,
        opacity: 0
    }, 0.4, function() {
        console.log("completed animation!");
    });
    Anima.queue(frame);
    Anima.play();

By queuing animations onto a frame, all animation units in the frame will be played in the same time. There is also a convenience method:

    Anima.frame([
        {
            element: el,
            properties: {
            	left: 100
            },
            duration: "100ms"
        }, {
            element: el2,
            properties: {
            	left: 100
            },
            duration: "100ms"
        }
    ]
    Anima.play();

All play methods return a `Runner` object. The `Runner` object allows you to cancel a series of animations by calling:

    var runner = Anima.play();
    // ... some code
    runner.abort();

You can also set default values for duration, delay and timingFunction by setting

    Anima.Defaults.Duration = "100ms"
	Anima.Defaults.Delay = "100s"
	Anima.Defaults.TimingFunction = "ease-in"

If the browser does not support CSS transitions, CSS property changes will happen immediately and callbacks will fire.

For more examples, look at the test page located under test/ 

## API

#### Queue
    
    Anima.queue(element, properties, duration [, delay] [, timingFunction] [, callback])

or

	Anima.queue({
	     element: (Dom Element),
	     properties: (Object of key value pairs),
	     duration: (time in s or ms | number for s or string),
	     delay: (time in s or ms | number for s or string | optional),
		 timingFunction: (timing function in string),
	     callback: (callback function | optional)
	})

returns the Anima object
    
#### Frame
    
    Anima.frame(operations [, callback])
    
operations is an array with the following objects:

    {
	     element: (Dom Element),
	     properties: (Object of key value pairs),
	     duration: (time in s or ms | number for s or string),
	     delay: (time in s or ms | number for s or string | optional),
		 timingFunction: (timing function in string),
	     callback: (callback function | optional)
    }

returns the frame object

#### Play

    Anima.play([callback]);
    
Returns a runner object
    
#### Step
Runs one animation or frame in the queue

    Anima.step([callback]);

Returns a runner object
    
#### Animate
Convenience function to add one animation and run it immediately

    Anima.animate(element, properties, duration [, delay] [, timingFunction] [, callback]);

Accepts object notation as well

#### Abort
Aborts all current running animations

    Anima.abort();
    
### Anima.Frame

Frame object. Represents one or more animations to be executed concurrently. 

Create a new frame:

    var frame = new Anima.Frame();

#### Frame.Queue

    frame.queue(element, options, duration [, delay] [, timingFunction]  [, callback])

returns the frame object. Supports object notation as well.

### Anima.Runner

Returned from the `play()` or `step()` functions

### Anima.Abort/Runner.Abort/Frame.Abort

Abort the current sequence of animations based on the scope of global (Anima), a play sequence (Runner) or a frame (Frame)

    runner.abort();


#### Anima.Finish/Runner.Finish/Frame.Finish

Finish the current sequence of animations i.e. force to the last frame based on the scope of global (Anima), a play sequence (Runner) or a frame (Frame)

    Anima.finish([performCallback])

finishes all current running animations, or

    runner.finish([performCallback])

finishes the animation runned by the current runner. Finish takes an optional `performCallback` boolean. If the boolean is not provided, it is assumed to be true. If the boolean is false, callbacks will then not fire.

## Limitations

* Currently, if the transition does not trigger an actual change (there is no property change), the callbacks will not fire. This is consistent with the CSS TransitionEnd property being fired. Unfortunately, this means that a bunch of things break. Will consider fixing this in the future.
* Since this is CSS based, don't apply multiple animations on a single element at once. It's ok to have multiple properties in one animation unit, but don't apply multiple animation units concurrently on one element. Bad things will happen
* The list of supported CSS properties is currently very limited. It will be added as I use and require more. Feel free to make a pull request or feature request
                                           
## License                                                                      
(The MIT License)

Copyright (c) 2012 Chong Han Chua <johncch@live.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
