/**
🚪
@file exit-from-dialog
@summary exit to another room from dialog, including conditionals
@license WTFPL (do WTF you want)
@version 3.0.1
@requires Bitsy Version: 4.5, 4.6
@author @mildmojo

@description
Lets you exit to another room from dialog (including inside conditionals). Use
it to make an invisible sprite that acts as a conditional exit, use it to warp
somewhere after a conversation, use it to put a guard at your gate who only
lets you in once you're disguised, use it to require payment before the
ferryman will take you across the river.

Using the (exit) function in any part of a series of dialog will make the
game exit to the new room after the dialog is finished. Using (exitNow) will
immediately warp to the new room, but the current dialog will continue.

WARNING: In exit coordinates, the TOP LEFT tile is (0,0). In sprite coordinates,
         the BOTTOM LEFT tile is (0,0). If you'd like to use sprite coordinates,
         add the word "sprite" as the fourth parameter to the exit function.

Usage: (exit "<room name>,<x>,<y>")
       (exit "<room name>,<x>,<y>,sprite")
       (exitNow "<room name>,<x>,<y>")
       (exitNow "<room name>,<x>,<y>,sprite")

Example: (exit "FinalRoom,8,4")
         (exitNow "FinalRoom,8,11,sprite")

HOW TO USE:
  1. Copy-paste this script into a new script tag after the Bitsy source code.
     It should appear *before* any other mods that handle loading your game
     data so it executes *after* them (last-in first-out).

NOTE: This uses parentheses "()" instead of curly braces "{}" around function
      calls because the Bitsy editor's fancy dialog window strips unrecognized
      curly-brace functions from dialog text. To keep from losing data, write
      these function calls with parentheses like the examples above.

      For full editor integration, you'd *probably* also need to paste this
      code at the end of the editor's `bitsy.js` file. Untested.
*/
(function (bitsy) {
'use strict';

bitsy = bitsy && bitsy.hasOwnProperty('default') ? bitsy['default'] : bitsy;

/**
@file utils
@summary miscellaneous bitsy utilities
@author Sean S. LeBlanc
*/

/*helper used to inject code into script tags based on a search string*/
function inject(searchString, codeToInject) {
	var args = [].slice.call(arguments);
	codeToInject = flatten(args.slice(1)).join('');

	// find the relevant script tag
	var scriptTags = document.getElementsByTagName('script');
	var scriptTag;
	var code;
	for (var i = 0; i < scriptTags.length; ++i) {
		scriptTag = scriptTags[i];
		var matchesSearch = scriptTag.textContent.indexOf(searchString) !== -1;
		var isCurrentScript = scriptTag === document.currentScript;
		if (matchesSearch && !isCurrentScript) {
			code = scriptTag.textContent;
			break;
		}
	}

	// error-handling
	if (!code) {
		throw 'Couldn\'t find "' + searchString + '" in script tags';
	}

	// modify the content
	code = code.replace(searchString, searchString + codeToInject);

	// replace the old script tag with a new one using our modified code
	var newScriptTag = document.createElement('script');
	newScriptTag.textContent = code;
	scriptTag.insertAdjacentElement('afterend', newScriptTag);
	scriptTag.remove();
}

/**
 * Helper for getting an array with unique elements 
 * @param  {Array} array Original array
 * @return {Array}       Copy of array, excluding duplicates
 */
function unique(array) {
	return array.filter(function (item, idx) {
		return array.indexOf(item) === idx;
	});
}

function flatten(list) {
	if (!Array.isArray(list)) {
		return list;
	}

	return list.reduce(function (fragments, arg) {
		return fragments.concat(flatten(arg));
	}, []);
}

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


// Examples: inject('names.sprite.set( name, id );', 'console.dir(names)');
//           inject('names.sprite.set( name, id );', 'console.dir(names);', 'console.dir(sprite);');
//           inject('names.sprite.set( name, id );', ['console.dir(names)', 'console.dir(sprite);']);
function inject$1(searchString, codeFragments) {
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
function before(targetFuncName, beforeFn) {
	var kitsy = kitsyInit();
	kitsy.queuedBeforeScripts[targetFuncName] = kitsy.queuedBeforeScripts[targetFuncName] || [];
	kitsy.queuedBeforeScripts[targetFuncName].push(beforeFn);
}

// Ex: after('load_game', function run() { alert('Loaded!'); });
function after(targetFuncName, afterFn) {
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
		inject: inject$1,
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
		inject(injectScript.searchString, injectScript.codeFragments);
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



var queuedDialogExit = null;

// Hook into game load and rewrite custom functions in game data to Bitsy format.
before('load_game', function (game_data, startWithTitle) {
	// Rewrite custom functions' parentheses to curly braces for Bitsy's
	// interpreter. Unescape escaped parentheticals, too.
	var fixedGameData = game_data
	.replace(/(^|[^\\])\((exit(Now)? ".+?")\)/g, "$1{$2}") // Rewrite (exit...) to {exit...}
	.replace(/\\\((exit(Now)? ".+")\\?\)/g, "($1)"); // Rewrite \(exit...\) to (exit...)
	return [fixedGameData, startWithTitle];
});

// Hook into the game reset and make sure exit data gets cleared.
after('clearGameData', function () {
	queuedDialogExit = null;
});

// Hook into the dialog finish event; if there was an {exit}, travel there now.
after('onExitDialog', function () {
	if (queuedDialogExit) {
		doPlayerExit(queuedDialogExit);
		queuedDialogExit = null;
	}
});

// Implement the {exit} dialog function. It saves the room name and
// destination X/Y coordinates so we can travel there after the dialog is over.
bitsy.exitFunc = function (environment, parameters, onReturn) {
	queuedDialogExit = _getExitParams('exit', parameters);

	onReturn(null);
};

// Implement the {exitNow} dialog function. It exits to the destination room
// and X/Y coordinates right damn now.
bitsy.exitNowFunc = function (environment, parameters, onReturn) {
	var exitParams = _getExitParams('exitNow', parameters);
	if (!exitParams) {
		return;
	}

	doPlayerExit(exitParams);
	onReturn(null);
};

// Rewrite the Bitsy script tag, making these new functions callable from dialog.
inject$1(
	'var functionMap = new Map();',
	'functionMap.set("exit", exitFunc);',
	'functionMap.set("exitNow", exitNowFunc);'
);

function _getExitParams(exitFuncName, parameters) {
	var params = parameters[0].split(',');
	var roomName = params[0];
	var x = params[1];
	var y = params[2];
	var coordsType = (params[3] || 'exit').toLowerCase();
	var useSpriteCoords = coordsType === 'sprite';
	var roomId = bitsy.names.room.get(roomName);

	if (!roomName || x === undefined || y === undefined) {
		console.warn('{' + exitFuncName + '} was missing parameters! Usage: {' +
			exitFuncName + ' "roomname,x,y"}');
		return null;
	}

	if (roomId === undefined) {
		console.warn("Bad {" + exitFuncName + "} parameter: Room '" + roomName + "' not found!");
		return null;
	}

	return {
		room: roomId,
		x: Number(x),
		y: useSpriteCoords ? 15 - Number(y) : Number(y)
	};
}

// dest === {room: Room, x: Int, y: Int}
function doPlayerExit(dest) {
	bitsy.player().room = dest.room;
	bitsy.player().x = dest.x;
	bitsy.player().y = dest.y;
	bitsy.curRoom = dest.room;
}
// End of (exit) dialog function mod

}(window));
