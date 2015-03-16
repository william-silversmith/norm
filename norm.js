"use strict";

function norm () {
	var _this = {};
	var _partials = resetPartials();

	function resetPartials() {
		return {
			select: null,
			from: null,
			where: null,
			groupby: null,
			orderby: null,
			limit: null,
			binds: [],
		};
	}

	function processArguments (fn, args, conjunction) {
		args.forEach(function (stmt) {
			if (Array.isArray(stmt)) {
				fn = (function (fn) {
					var sql = stmt[0];
					var binds = stmt.slice(1); // for idempotency: must not modify statement, slice makes a copy

					binds.forEach(function (bnd) {
						if (typeof(bnd.sql) === 'function') {
							sql = sql.replace(/\?/, bnd.sql());
							_partials.binds.push.apply(_partials.binds, bnd.binds());
						}
						else {
							_partials.binds.push(bnd);	
						}
					});

					return fn() + " " + sql + conjunction;

				}).bind(_this, fn);
			}
			else if (typeof(stmt) === 'function') {
				fn = (function (fn) {
					return fn() + " " + stmt() + conjunction;
				}).bind(_this, fn);
			}
			else if (stmt.sql) {
				fn = (function (fn) {
					return fn() + " (" + stmt.sql() + ")" + conjunction;
				}).bind(_this, fn);
			}
			else { // e.g. str, bool, num, object (w/ toString)
				fn = (function (fn) {
					return fn() + " " + stmt + conjunction;
				}).bind(_this, fn);
			}
		});

		return fn;
	}

	_this.select = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.select || function () { return "select" };

		_partials.select = processArguments(fn, args, ",");

		return _this;
	};

	_this.from = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.from || function () { return "from" };

		_partials.from = processArguments(fn, args, ",");

		return _this;
	};

	_this.where = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.from || function () { return "from" };

		_partials.from = processArguments(fn, args, " and ");

		return _this;
	};

	_this.groupby = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.groupby || function () { return "group by" };

		_partials.groupby = processArguments(fn, args, ",");
	};

	_this.orderby = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials.orderby || function () { return "order by" };

		_partials.orderby = processArguments(fn, args, ",");
	};

	_this.limit = function (lower, upper) {
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

	_this.distinct = function () {
		if (!_partials.select) {
			_partials.select = function () { return  "select distinct " };
		}
		else {
			_partials.select = (function (fn) {
				var sql = fn();
				return sql.replace(/^\s*select(\s*distinct)?/, "select distinct");
			}).bind(_this, _partials.select);
		}

		return _this;
	};

	_this.and = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = function () { return "" };

		fn = processArguments(fn, args, " and ");

		return function () {
			return "(" + fn() + ")";
		};
	};

	_this.or = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = function () { return "" };
		
		fn = processArguments(fn, args, " or ");

		return function () {
			return "(" + fn() + ")";
		};
	};

	_this.sql = function () {
		var striplast = function (conjunction, fn) {
			var regex = new RegExp(conjunction + "\s*$");
			return function () {
				return fn().replace(regex, ''); // remove last comma
			};
		};

		var fns = [
		 	striplast(",", _partials.select || function () { return "select 1" }),
		 	striplast(",", _partials.from || function () { return "from dual" }),
		 	striplast("and", _partials.where || function () { return "" }),
		 	striplast(",", _partials.groupby || function () { return "" }),
		 	striplast(",", _partials.orderby || function () { return "" }),
		 	_partials.limit || function () { return  "" }
		];

		// binds are computed freshly each time as a side effect
		_partials.binds = []; 

		return fns
			.map(function (fn) {
				return fn();
			}).join(" ").trim();
	};

	_this.sqlAndBinds = function () {
		return { sql: _this.sql(), binds: _partials.binds };
	};

	_this.binds = function () {
		return _this.sqlAndBinds().binds;
	};

	_this.reset = function () {
		_partials = resetPartials();
	};

	_this.toString = _this.sql;

	return _this;
}

module.exports = norm;






