////
// Author: Johan Beronius, johanb@athega.se, http://www.athega.se/, 2009
// License: Use however you want, just credit the author :-)
////

window.addEvent('load', function() {

	var sudokuData = new SudokuData();
	var inputs = $$('table.sudoku input');

	inputs.each(function(el, i) {
		if (i==0) el.focus();
		el.setProperty('maxlength', '1');
		el.value = '';
		el.addEvent('keydown', function(event) {
			if (event.code >= 97 && event.code <= 105) event.code -= 48; // Catch numeric keys
			if (event.code >= 49 && event.code <= 57) { // Only allow valid numbers to be entered
				var n = event.code - 48;
				var oldValue = el.value;
				el.value = n;
				sudokuData.load(inputs);
				if (!sudokuData.validate()) {
					el.value = oldValue;
					el.getParent().highlight('#FF7777');
					return event.stop();
				}
				el.value='';
			}
			else if (event.code == 13 || event.code == 32 || event.code == 39) { // Move to next on enter, space and right arrow
				inputs[i+1 < inputs.length ? i+1 : 0].focus();
			}
			else if (event.code == 37) { // Move to previous on left arrow
				inputs[i-1 >= 0 ? i-1 : inputs.length-1].focus();
			}
			else if (event.code == 38) { // Move to previous row on up arrow
				inputs[i-3 >= 0 ? i-3 : inputs.length+i-3].focus();
			}
			else if (event.code == 40) { // Move to next row on down arrow
				inputs[i+3 < inputs.length ? i+3 : i+3-inputs.length].focus();
			}
			else if (event.code == 8 || event.code == 46) { // Clear box on backspace or delete
				el.value='';
			}
			else if (event.code != 9) event.stop(); // Don't stop tabs
		});

		el.addEvent('keyup', function(event) {
			if (event.code >= 97 && event.code <= 105) event.code -= 48; // Catch numeric keys
			if (event.code >= 49 && event.code <= 57 && el.value && sudokuData.valid) { // Move to next after valid numbers
				inputs[i+1 < inputs.length ? i+1 : 0].focus();
			}
			else if (event.code == 8) { // Move to previous on backspace
				inputs[i-1 >= 0 ? i-1 : inputs.length-1].focus();
			}
			else if (event.code == 46) { // Move to next on delete
				inputs[i+1 < inputs.length ? i+1 : 0].focus();
			}
		});

	});

	if (document.location.hash) {
		if (sudokuData.decode(document.location.hash.substr(1)))
			sudokuData.update(inputs);
		$('theLink').setProperty('href', document.location.hash);
	}

	var startButton = $('startButton');
	startButton.disabled = false;

	$('resetButton').addEvent('click', function() {
		inputs.removeClass('calculated');
		inputs[0].focus();
		$$('#statistics > div').removeClass('show');
		sudokuData.stop();
		startButton.disabled = false;
		document.location.hash = '';
		$('theLink').setProperty('href', '#');
	});

	startButton.addEvent('click', function() {
		startButton.disabled = true;

		$$('#statistics > div').removeClass('show');

		sudokuData = new SudokuData();
		sudokuData.load(inputs);

		inputs.each(function(el) {
			if (el.value) el.removeClass('calculated');
			else el.addClass('calculated');
		});

		if (!sudokuData.validate() || sudokuData.count() < 18) {
			$('statInvalid').addClass('show');
			startButton.disabled = false;
			return;
		}

		document.location.hash = '#' + sudokuData.encode();
		$('theLink').setProperty('href', document.location.hash);

		$('statsFixedNumbers').set('text', sudokuData.count());
		$('statFixed').addClass('show');

		sudokuData.doneCallback = function() {
			if (sudokuData.stats.solutionsFound == 0) $('statNoSolution').addClass('show');
			$('statDone').addClass('show');
			startButton.disabled = false;
		};

		sudokuData.updateCallback = function() {
			if (sudokuData.stats.solutionsFound) sudokuData.update(inputs);
			$('statsSolutions').set('text', sudokuData.stats.solutionsFound);
			$('statsIterations').set('text', sudokuData.stats.iterations);
			$('statsUnsolvable').set('text', sudokuData.stats.unsolvable);
			$('statsSolvedByNumberExclusion').set('text', sudokuData.stats.solvedByNumberExclusion);
			$('statsSolvedByPositionExclusion').set('text', sudokuData.stats.solvedByPositionExclusion);
			$('statsSolvedByBranching').set('text', sudokuData.stats.solvedByBranching);
			var time = (sudokuData.stats.processingTime/1000).round(1);
			$('statsProcessingTime').set('text', time + (time % 1 ? '' : '.0') + 's');
			$('statSolved').addClass('show');
		};

		sudokuData.solve();
	});

});
