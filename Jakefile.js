/**
 * Build file to build Anima.
 * Requires closure compiler (From homebrew or as jar)
 * 
 * This code is in public domain.
 */
var OUTPUT_DIR = "dist/";
var CLOSURE = "closure-compiler"; // or "java -jar compiler.jar"
var hr = "========================================================"; 

desc("Compress JavaScript using closure-compiler");
task("compress", function() {
	console.log(hr);
	console.log("Compressing JavaScript with the closure compiler");
	console.log(hr);
	
	var commandStr = CLOSURE;
	commandStr += " --js src/anima.js";
	commandStr += " --js_output_file src/anima.min.js"

	jake.exec(commandStr, function() {
		console.log("Finished compressing js files");
		console.log("");
		complete();
	}, { printStdout: true });

}, { async: true });

desc("Default Task");
task("default", ["compress"], function() {

});


