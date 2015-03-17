"use strict";

function norm (state) {
	var _this = {};
	var _partials = state || resetPartials();

	function resetPartials() {
		return {
			select: null,
			from: null,
			where: null,
			groupby: null,
			orderby: null,
			limit: null,
			distinct: false,
		};
	}

	function processArguments (fn, args, conjunction) {
		args.forEach(function (stmt) {
			if (Array.isArray(stmt)) {
				fn = (function (fn, sql_binds) {
					var sql = stmt[0];

					// for idempotency: must not modify statement, slice makes a copy
					var stmt_binds = stmt.slice(1);
					stmt_binds.reverse();
					stmt_binds.forEach(function (bnd) {
						if (typeof(bnd.sql) === 'function') {
							var result = bnd.sqlAndBinds();

							var subsql = result[0];
							var subbinds = result[1];

							subbinds.reverse(); // since we're going to reverse them again...

							sql = sql.replace(/\?/, subsql);
							
							sql_binds.push.apply(sql_binds, subbinds);
						}
						else {
							sql = sql.replace(/\?/, '¿');
							sql_binds.push(bnd); 
						}
					});

					sql = sql.replace(/¿/g, '?');

					return fn(sql_binds) + " " + sql + conjunction;

				}).bind(_this, fn);
			}
			else if (typeof(stmt) === 'function') {
				fn = (function (fn, binds) {
					return fn(binds) + " " + stmt(binds) + conjunction;
				}).bind(_this, fn);
			}
			else if (stmt.sql) {
				fn = (function (fn, binds) {
					return fn(binds) + " (" + stmt.sql() + ")" + conjunction;
				}).bind(_this, fn);
			}
			else { // e.g. str, bool, num, object (w/ toString)
				fn = (function (fn, binds) {
					return fn(binds) + " " + stmt + conjunction;
				}).bind(_this, fn);
			}
		});

		return fn;
	}

	_this.select = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.select || function () { return "select" };

		if (!args.length) {
			return _this;
		}

		_partials.select = processArguments(fn, args, ",");

		return _this;
	};

	_this.from = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.from || function () { return "from" };

		if (!args.length) {
			return _this;
		}

		args.forEach(function (arg) {
			if (arg.sql) {
				throw new Error("You need to name your subquery: " + arg.sql());
			}
		});

		_partials.from = processArguments(fn, args, ",");

		return _this;
	};

	_this.where = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.where || function () { return "where" };

		if (!args.length) {
			return _this;
		}

		_partials.where = processArguments(fn, args, " and");

		return _this;
	};

	_this.groupby = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.groupby || function () { return "group by" };

		if (!args.length) {
			return _this;
		}

		_partials.groupby = processArguments(fn, args, ",");
		
		return _this;
	};

	_this.orderby = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.orderby || function () { return "order by" };

		if (!args.length) {
			return _this;
		}

		_partials.orderby = processArguments(fn, args, ",");

		return _this;
	};

	_this.limit = function (lower, upper) {
		if (!lower && lower !== 0) {
			return _this;
		}

		if (upper || upper === 0) {
			_partials.limit = function () {
				return "limit " + lower + ", " + upper;
			};
		}
		else {
			_partials.limit = function () {
				return "limit " + lower;
			};
		}

		return _this;
	};

	_this.distinct = function (yes) {
		if (yes === undefined) {
			_partials.distinct = true;
		}
		else {
			_partials.distinct = yes;
		}

		return _this;
	};

	_this.and = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = function () { return "" };

		fn = processArguments(fn, args, " and");

		return function (binds) {
			var expr = fn(binds).replace(/and\s*$/, '');
			return "(" + expr.trim() + ")";
		};
	};

	_this.or = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = function () { return "" };
		
		fn = processArguments(fn, args, " or");

		return function (binds) {
			var expr = fn(binds).replace(/or\s*$/, '');
			return "(" + expr.trim() + ")";
		};
	};

	_this.sqlAndBinds = function () {
		var striplast = function (conjunction, fn) {
			var regex = new RegExp(conjunction + "\\s*$");
			return function (binds) {
				return fn(binds).replace(regex, ''); // remove last comma
			};
		};

		var fns = [
		 	striplast(",", _partials.select || function () { return "select 1" }),
		 	striplast(",", _partials.from || function () { return "from dual" }),
		 	striplast(" and", _partials.where || function () { return "" }),
		 	striplast(",", _partials.groupby || function () { return "" }),
		 	striplast(",", _partials.orderby || function () { return "" }),
		 	_partials.limit || function () { return  "" }
		];

		if (_partials.distinct) {
			 fns[0] = (function (fn, binds) {
			 	return fn(binds).replace(/^\s*select(\s*distinct)?/, "select distinct");
			 }).bind(_this, fns[0]);
		}

		// binds are computed freshly each time as a side effect
		var binds = []; 

		var sql = fns
			.map(function (fn) {
				return fn(binds);
			})
			.filter(function (str) {
				return str !== "";
			}).join(" ").trim();

		// binds are added in reverse order b/c functions are evaluated outside-in
		binds.reverse(); 

		return [ sql, binds ];
	};

	_this.sql = function () {
		return _this.sqlAndBinds()[0];
	};

	_this.binds = function () {
		return _this.sqlAndBinds()[1];
	};

	_this.reset = function () {
		_partials = resetPartials();
	};

	_this.clone = function () {
		var state = {};
		Object.keys(_partials).forEach(function (key) {
			state[key] = _partials[key];
		});

		return norm(state);
	};

	_this.toString = _this.sql;

	// Generate array parameter versions of select, from, etc
	// as 'selecta', 'froma', etc
	['select', 'from', 'where', 'groupby', 'orderby'].forEach(function (funcname) {
		_this[funcname + 'a'] = function (array) {
			return _this[funcname].apply(_this, array);
		};
	});

	return _this;
}

module.exports = norm;



