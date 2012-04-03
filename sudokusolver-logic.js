////
// Author: Johan Beronius, johanb@athega.se, http://www.athega.se/, 2009
// License: Use however you want, just credit the author :-)
////


// This javascript source will be run both in window and worker context
// If we're in a worker we need to masquerade the global context and load mootools
if (self.importScripts) {
	document = {
		prototype: function() {},
		createElement: function() {},
		getElementsByTagName: function() {return []}
	};
	window = {
		document: document,
		Document: document,
		Element: { prototype: function() {} },
		Window:  { prototype: function() {} },
		addEventListener: function() {},
		attachEvent: function() {}
	};
	self.importScripts('mootools.js');
}


Array.implement({
	hasTrueDuplicates: function() {
		var l = this.length;
		for (var y=0; y<l; y++) {
			for (var x=l-1; x>0; x--) {
				if (x<=y) break;
				if (!this[x]) continue;
				if (this[x]==this[y]) return true;
			}
		}
		return false;
	},

	eraseAll: function(array) {
		for (var i = array.length; i--; i) {
			this.erase(array[i]);
		}
		return this;
	}
});



// Contructor that returns a new new instance of this class
// extended with all properties of the given data structure
Class.prototype.bless = function(data) {
	return $extend(new this(), data);
};


var SudokuGrid = new Class({
	initialize: function() {
		this.count = 0;
		this.options = [];
		for (var ry=0; ry<3; ry++) {
			this[ry] = [];
			this.options[ry] = [];
			for (var rx=0; rx<3; rx++) {
				this[ry][rx] = [];
				this.options[ry][rx] = [];
				for (var y=0; y<3; y++) {
					this[ry][rx][y] = [];
					this.options[ry][rx][y] = [];
					for (var x=0; x<3; x++) {
						this.options[ry][rx][y][x] = [1,2,3,4,5,6,7,8,9];
					}
				}
			}
		}
	},

	getRowArray: function(ry, y) {
		return (
			this[ry][0][y].concat(
			this[ry][1][y],
			this[ry][2][y]
		));
    },

	getColumnArray: function(rx, x) {
		return [
			this[0][rx][0][x],
			this[0][rx][1][x],
			this[0][rx][2][x],
			this[1][rx][0][x],
			this[1][rx][1][x],
			this[1][rx][2][x],
			this[2][rx][0][x],
			this[2][rx][1][x],
			this[2][rx][2][x]
		];
    },

	getRegionArray: function(rx, ry) {
		return (
			this[ry][rx][0].concat(
			this[ry][rx][1],
			this[ry][rx][2]
		));
    },

	getOptions: function(rx, ry, x, y) {
		var row    = this.getRowArray(ry, y);
		var column = this.getColumnArray(rx, x);
		var region = this.getRegionArray(rx, ry);
		var other  = row.concat(column).concat(region);
		var options = [1,2,3,4,5,6,7,8,9].eraseAll(other);
		return options;
    },

    calcOptions: function() {
		// Pre-calc possible options for all positions
		this.count = 0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						if (this[ry][rx][y][x]) this.count++;
						this.options[ry][rx][y][x] = this.getOptions(rx, ry, x, y);
					}
				}
			}
		}
	},

	setNumber: function(rx, ry, x, y, n) {

		this[ry][rx][y][x] = n;
		this.count++;

		// Remove this option from related column
		for (var iry=0; iry<3; iry++) {
			for (var iy=0; iy<3; iy++) {
				this.options[iry][rx][iy][x].erase(n);
			}
		}

		// Remove this option from related row
		for (var irx=0; irx<3; irx++) {
			for (var ix=0; ix<3; ix++) {
				this.options[ry][irx][y][ix].erase(n);
			}
		}

		// Remove this option from related region
		for (var iy=0; iy<3; iy++) {
			for (var ix=0; ix<3; ix++) {
				this.options[ry][rx][iy][ix].erase(n);
			}
		}
    }


});



var SudokuData = new Class({
	initialize: function() {
		this.grid = new SudokuGrid();
		this.solution;
		this.queue = [];
		this.stats = {
			solutionsFound: 0,
			branches: 0,
			iterations: 0,
			unsolvable: 0,
			solvedByNumberExclusion: 0,
			solvedByPositionExclusion: 0,
			solvedByBranching: 0,
			maxQueueLength: 0,
			processingTime: 0,
			worker1: 0,
			worker2: 0,
			worker3: 0,
			worker4: 0
		};
	},

	load: function(inputs) {
		var i=0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						var v = inputs[i++].value;
						this.grid[ry][rx][y][x] = v ? parseInt(v) : '';
					}
				}
			}
		}

	},

	update: function(inputs) {
		var i=0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						inputs[i++].value = this.grid[ry][rx][y][x];
					}
				}
			}
		}

	},

	base64chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",

	encode: function() {
		var string = '';
		var count = 0;
		var bits = 0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						var v = this.grid[ry][rx][y][x];

						// Encode 1 bit as a flag if there is a value or not
						bits <<= 1;
						if (v) bits++;
						count++;

						if (count == 6) { // Flush if we got 6 bits
							string += this.base64chars.charAt(bits);
							bits = 0;
							count = 0;
						}

						// If there is a value, encode it in 4 bits
						if (!v) continue;
						for (var i=0; i<4; i++) {
							bits <<= 1;
							if (v & 8) bits++;
							v <<= 1;
							count++;

							if (count == 6) { // Flush if we got 6 bits
								string += this.base64chars.charAt(bits);
								bits = 0;
								count = 0;
							}
						}
					}
				}
			}
		}

		if (count > 0) { // Flush the last 1-5 bits
			bits <<= (6-count);
			string += this.base64chars.charAt(bits);
		}

		return string;

	},

	decode: function(string) {
		var values = [];
		var value = 0;
		var bitcount = 0;

		for (var i=0; i<string.length; i++) {
			var bits = this.base64chars.indexOf(string.charAt(i));
			if (bits == -1) return false; // Illegal character detected
			for (var b=0; b<6; b++) {
				var bit = bits & 32 ? 1 : 0;
				bits <<= 1;

				if (bit == 0 && bitcount == 0) { // Store a 0 and continue
					values.push(0);
				} else if (bit == 1 && bitcount == 0) { // Skip this bit and accumulate next 4
					bitcount = 4;
				} else if (bitcount > 0) { // If we got bits left
					value <<= 1;
					value += bit;
					if (--bitcount == 0) { // Store value after 4 bits
						if (value > 9) return false; // To high detected
						values.push(value);
						value = 0;
					}
				}
			}
		}

		var i=0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						var v = values[i++];
						this.grid[ry][rx][y][x] = v ? v : '';
					}
				}
			}
		}

		return true;
	},


	count: function() {
		var c=0;
		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				for (var y=0; y<3; y++) {
					for (var x=0; x<3; x++) {
						if (this.grid[ry][rx][y][x]) c++;
					}
				}
			}
		}
		return c;
	},

	validate: function() {

		for (var ry=0; ry<3; ry++) {
			for (var y=0; y<3; y++) {
				var row    = this.grid.getRowArray(ry, y);
				if (row.hasTrueDuplicates()) return this.valid = false;
			}
		}

		for (var rx=0; rx<3; rx++) {
			for (var x=0; x<3; x++) {
				var column = this.grid.getColumnArray(rx, x);
				if (column.hasTrueDuplicates()) return this.valid = false;
			}
		}

		for (var ry=0; ry<3; ry++) {
			for (var rx=0; rx<3; rx++) {
				var region = this.grid.getRegionArray(rx, ry);
				if (region.hasTrueDuplicates()) return this.valid = false;
			}
		}

		return this.valid = true;
	},

	solve: function() {
		this.stats.solutionsFound = 0;
		this.stats.branches = 0;
		this.stats.iterations = 0;
		this.stats.unsolvable = 0;
		this.stats.solvedByNumberExclusion = 0;
		this.stats.solvedByPositionExclusion = 0;
		this.stats.solvedByBranching = 0;
		this.stats.maxQueueLength = 0;
		this.stats.processingTime = 0;
		this.stats.startTime = new Date().getTime();

		this.grid.calcOptions();
		this.queue.push(this.grid);

		if (window.Worker)
			this.workerQueue();
		else
			this.timerQueue();
    },


	timerQueue: function() {
		var startTime = new Date().getTime();
		var runTime;

		while (this.queue.length > 0) {

			if (this.stats.maxQueueLength < this.queue.length)
				this.stats.maxQueueLength = this.queue.length;

			var grid = this.queue.pop();
			if (this.solveBranch(grid)) {
				this.solution = grid;
				this.stats.solutionsFound++;
			}

			runTime = new Date().getTime() - startTime;
			if (runTime > 100) {
				if (this.solution)
					this.grid = this.solution;

				this.stats.processingTime += runTime;
				this.updateCallback();
				return this.timerQueueId = this.timerQueue.delay(20, this);
			}
		}

		this.stats.processingTime += runTime;
		this.updateCallback();
		this.doneCallback();
    },

	stop: function() {
		this.queue.empty();
		$clear(this.timerQueueId);
		$clear(this.timerUpdateId);
    },


	workerQueue: function() {

		var thisSudokuData = this;

		worker1.onmessage = worker2.onmessage = worker3.onmessage = worker4.onmessage = function(event) {
			this.busy = false;
			var data = JSON.decode(event.data);

			for (var i in data.stats)
				thisSudokuData.stats[i] += data.stats[i];

			for (var i=0; i<data.queue.length; i++) {
				var grid = SudokuGrid.bless(data.queue[i]);
				thisSudokuData.queue.push(grid);
			}

			if (thisSudokuData.stats.maxQueueLength < thisSudokuData.queue.length)
				thisSudokuData.stats.maxQueueLength = thisSudokuData.queue.length;


			if (thisSudokuData.queue.length == 0 && !worker1.busy && !worker2.busy && !worker3.busy && !worker4.busy) {
				$clear(thisSudokuData.timerUpdateId);
				thisSudokuData.updateCallback();
				thisSudokuData.doneCallback();
				return;
			}

			while (thisSudokuData.queue.length > 0 && (!worker1.busy || !worker2.busy || !worker3.busy || !worker4.busy)) {
				var grid = thisSudokuData.queue.pop();
				if      (!worker1.busy) { thisSudokuData.stats.worker1++; worker1.solveBranch(grid); }
				else if (!worker2.busy) { thisSudokuData.stats.worker2++; worker2.solveBranch(grid); }
				else if (!worker3.busy) { thisSudokuData.stats.worker3++; worker3.solveBranch(grid); }
				else if (!worker4.busy) { thisSudokuData.stats.worker4++; worker4.solveBranch(grid); }
			}

		};

		var grid = this.queue.pop();
		worker1.solveBranch(grid);
		this.timerUpdateId = this.updateCallback.periodical(200, this);
    },


	solveBranch: function(grid) {

		this.stats.branches++;

		// Iterate over grid until no more numbers can be solved.
		do {
			var solvedThisIteration=0;
			this.stats.iterations++;



			// Search for possible positions for each missing number in every row
			for (var ry=0; ry<3; ry++) {
				for (var y=0; y<3; y++) {
					var row = grid.getRowArray(ry, y);
					var missingNumbers = [1,2,3,4,5,6,7,8,9].eraseAll(row);
					rowNumbers: for (var i=0; i<missingNumbers.length; i++) {
						var n = missingNumbers[i];
						var possiblePosition = undefined;
						for (var rx=0; rx<3; rx++) {
							for (var x=0; x<3; x++) {
								if (grid[ry][rx][y][x]) continue;
								var options = grid.options[ry][rx][y][x];
								if (options.contains(n)) { // The number can exist at this position
									if (possiblePosition) continue rowNumbers; // More than one possible position found
									possiblePosition = {rx: rx, x: x};
								}
							}
						}
						if (!possiblePosition) { // Found a dead end with no possible positions.
							this.stats.unsolvable++;
							return false;
						}
						solvedThisIteration++;
						this.stats.solvedByPositionExclusion++;
						grid.setNumber(possiblePosition.rx, ry, possiblePosition.x, y, n);
						if (grid.count == 81) return true; // We have a solution
					}
				}
			}

			// Search for possible positions for each missing number in every column
			for (var rx=0; rx<3; rx++) {
				for (var x=0; x<3; x++) {
					var column = grid.getColumnArray(rx, x);
					var missingNumbers = [1,2,3,4,5,6,7,8,9].eraseAll(column);
					columnNumbers: for (var i=0; i<missingNumbers.length; i++) {
						var n = missingNumbers[i];
						var possiblePosition = undefined;
						for (var ry=0; ry<3; ry++) {
							for (var y=0; y<3; y++) {
								if (grid[ry][rx][y][x]) continue;
								var options = grid.options[ry][rx][y][x];
								if (options.contains(n)) { // The number can exist at this position
									if (possiblePosition) continue columnNumbers; // More than one possible position found
									possiblePosition = {ry: ry, y: y};
								}
							}
						}
						if (!possiblePosition) { // Found a dead end with no possible positions.
							this.stats.unsolvable++;
							return false;
						}
						solvedThisIteration++;
						this.stats.solvedByPositionExclusion++;
						grid.setNumber(rx, possiblePosition.ry, x, possiblePosition.y, n);
						if (grid.count == 81) return true; // We have a solution
					}
				}
			}

			// Search for possible positions for each missing number in every region
			for (var ry=0; ry<3; ry++) {
				for (var rx=0; rx<3; rx++) {
					var region = grid.getRegionArray(rx, ry);
					var missingNumbers = [1,2,3,4,5,6,7,8,9].eraseAll(region);
					regionNumbers: for (var i=0; i<missingNumbers.length; i++) {
						var n = missingNumbers[i];
						var possiblePosition = undefined;
						for (var y=0; y<3; y++) {
							for (var x=0; x<3; x++) {
								if (grid[ry][rx][y][x]) continue;
								var options = grid.options[ry][rx][y][x];
								if (options.contains(n)) { // The number can exist at this position
									if (possiblePosition) continue regionNumbers; // More than one possible position found
									possiblePosition = {x: x, y: y};
								}
							}
						}
						if (!possiblePosition) { // Found a dead end with no possible positions.
							this.stats.unsolvable++;
							return false;
						}
						solvedThisIteration++;
						this.stats.solvedByPositionExclusion++;
						grid.setNumber(rx, ry, possiblePosition.x, possiblePosition.y, n);
						if (grid.count == 81) return true; // We have a solution
					}
				}
			}





			// Fill in numbers for each position that can be determined without ambiguity.
			for (var ry=0; ry<3; ry++) {
				for (var rx=0; rx<3; rx++) {
					for (var y=0; y<3; y++) {
						for (var x=0; x<3; x++) {
							if (grid[ry][rx][y][x]) continue;

							var options = grid.options[ry][rx][y][x];
							if (options.length == 0) { // Found a dead end with no options left.
								this.stats.unsolvable++;
								return false;
							}
							if (options.length != 1) continue; // More than one option left, skip for now.
							solvedThisIteration++;
							this.stats.solvedByNumberExclusion++;
							grid.setNumber(rx, ry, x, y, options[0]);
							if (grid.count == 81) return true; // We have a solution
						}
					}
				}
			}


		} while (solvedThisIteration > 0);

		// We have a solution
		if (grid.count == 81) return true;

		// No solution yet but we're stuck.
		// Find options for first empty slot, clone alternative branchs and push on queue.
		for (var v=2; v<=9; v++) {
			for (var ry=0; ry<3; ry++) {
				for (var rx=0; rx<3; rx++) {
					for (var y=0; y<3; y++) {
						for (var x=0; x<3; x++) {
							if (grid[ry][rx][y][x]) continue;
							var options = grid.options[ry][rx][y][x];
							if (options.length == 0) return false; // Should not happen, dead ends should be trapped by earlier iteration.
							if (options.length == 1) return false; // Should not happen, unambiguous options should be set by earlier iteration.
							if (options.length != v) continue; // Continue if this is not the box with the least number of options.

							this.stats.solvedByBranching += options.length;

							options.each(function(option) {
								var branch = $unlink(grid);
								branch.setNumber(rx, ry, x, y, option);
								this.queue.push(branch);
							}, this);
							return false;
						}
					}
				}
			}
		}

		return false;
    }


});



// If we're in the window and workers are available
if (window.Worker) {

	worker1 = new Worker('sudokusolver-logic.js');
	worker2 = new Worker('sudokusolver-logic.js');
	worker3 = new Worker('sudokusolver-logic.js');
	worker4 = new Worker('sudokusolver-logic.js');
	worker1.busy = worker2.busy = worker3.busy = worker4.busy = false;
	worker1.solveBranch = worker2.solveBranch = worker3.solveBranch = worker4.solveBranch = function(grid) {
		this.busy = true;
		this.postMessage(JSON.encode(grid));
	};

// If we're in a worker
} else if (self.importScripts) {

	self.onmessage = function(event) {
		var grid = SudokuGrid.bless(JSON.decode(event.data));
		var sudokuData = new SudokuData();

		if (sudokuData.solveBranch(grid)) {
			sudokuData.solution = grid;
			sudokuData.stats.solutionsFound++;
		}

		self.postMessage(JSON.encode({stats: sudokuData.stats, queue: sudokuData.queue}));
	};

}

