/**

@file kitsy-script-toolkit
@summary makes it easier and cleaner to run code before and after Bitsy functions or to inject new code into Bitsy script tags
@license WTFPL (do WTF you want)
@version 2.0.0
@requires Bitsy Version: 4.5, 4.6
@author @mildmojo

@description
HOW TO USE:
  import {before, after, inject} from "./kitsy-script-toolkit.js";

  before(targetFuncName, beforeFn);
  after(targetFuncName, afterFn);
  inject(searchString, codeFragment1[, ...codefragmentN]);

  For more info, see the documentation at:
  https://github.com/seleb/bitsy-hacks/wiki/Coding-with-kitsy
*/
import bitsy from "bitsy";
import {
	unique,
	flatten,
	inject as utilsInject
} from "./utils.js";


// Examples: inject('names.sprite.set( name, id );', 'console.dir(names)');
//           inject('names.sprite.set( name, id );', 'console.dir(names);', 'console.dir(sprite);');
//           inject('names.sprite.set( name, id );', ['console.dir(names)', 'console.dir(sprite);']);
export function inject(searchString, codeFragments) {
	var kitsy = kitsyInit();
	var args = [].slice.call(arguments);
	codeFragments = flatten(args.slice(1));

	kitsy.queuedInjectScripts.push({
		searchString: searchString,
		codeFragments: codeFragments
	});
}

// Ex: before('load_game', function run() { alert('Loading!'); });
//     before('show_text', function run(text) { return text.toUpperCase(); });
//     before('show_text', function run(text, done) { done(text.toUpperCase()); });
export function before(targetFuncName, beforeFn) {
	var kitsy = kitsyInit();
	kitsy.queuedBeforeScripts[targetFuncName] = kitsy.queuedBeforeScripts[targetFuncName] || [];
	kitsy.queuedBeforeScripts[targetFuncName].push(beforeFn);
}

// Ex: after('load_game', function run() { alert('Loaded!'); });
export function after(targetFuncName, afterFn) {
	var kitsy = kitsyInit();
	kitsy.queuedAfterScripts[targetFuncName] = kitsy.queuedAfterScripts[targetFuncName] || [];
	kitsy.queuedAfterScripts[targetFuncName].push(afterFn);
}

function kitsyInit() {
	// return already-initialized kitsy
	if (bitsy.kitsy) {
		return bitsy.kitsy;
	}

	// Initialize kitsy
	bitsy.kitsy = {
		inject: inject,
		before: before,
		after: after,
		queuedInjectScripts: [],
		queuedBeforeScripts: {},
		queuedAfterScripts: {}
	};

	var oldStartFunc = bitsy.startExportedGame;
	bitsy.startExportedGame = function doAllInjections() {
		// Only do this once.
		bitsy.startExportedGame = oldStartFunc;

		// Rewrite scripts and hook everything up.
		doInjects();
		applyAllHooks();

		// Start the game
		bitsy.startExportedGame.apply(this, arguments);
	};

	return bitsy.kitsy;
}


function doInjects() {
	bitsy.kitsy.queuedInjectScripts.forEach(function (injectScript) {
		utilsInject(injectScript.searchString, injectScript.codeFragments);
	});
	_reinitEngine();
}

function applyAllHooks() {
	var allHooks = unique(Object.keys(bitsy.kitsy.queuedBeforeScripts).concat(Object.keys(bitsy.kitsy.queuedAfterScripts)));
	allHooks.forEach(applyHook);
}

function applyHook(functionName) {
	var superFn = bitsy[functionName];
	var superFnLength = superFn.length;
	var functions = [];
	// start with befores
	functions = functions.concat(bitsy.kitsy.queuedBeforeScripts[functionName] || []);
	// then original
	functions.push(superFn);
	// then afters
	functions = functions.concat(bitsy.kitsy.queuedAfterScripts[functionName] || []);

	// overwrite original with one which will call each in order
	bitsy[functionName] = function () {
		var args = [].slice.call(arguments);
		var i = 0;
		runBefore.apply(this, arguments);

		// Iterate thru sync & async functions. Run each, finally run original.
		function runBefore() {
			// All outta functions? Finish
			if (i === functions.length) {
				return;
			}

			// Update args if provided.
			if (arguments.length > 0) {
				args = [].slice.call(arguments);
			}

			if (functions[i].length > superFnLength) {
				// Assume funcs that accept more args than the original are
				// async and accept a callback as an additional argument.
				functions[i++].apply(this, args.concat(runBefore.bind(this)));
			} else {
				// run synchronously
				var newArgs = functions[i++].apply(this, args) || args;
				runBefore.apply(this, newArgs);
			}
		}
	};
}

function _reinitEngine() {
	// recreate the script and dialog objects so that they'll be
	// referencing the code with injections instead of the original
	bitsy.scriptModule = new bitsy.Script();
	bitsy.scriptInterpreter = bitsy.scriptModule.CreateInterpreter();

	bitsy.dialogModule = new bitsy.Dialog();
	bitsy.dialogRenderer = bitsy.dialogModule.CreateRenderer();
	bitsy.dialogBuffer = bitsy.dialogModule.CreateBuffer();
}