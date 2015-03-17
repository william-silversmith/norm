"use strict";

/* norm (no-are-em)
 *
 * A SQL builder that pastes SQL together without
 * getting too fancy.
 *
 * Example Typical Usage:
 *
 * var nsql = norm().select("u.id").from("users u").where("u.id = ?", 5);
 * db.query(nsql.sql(), nsql.binds(), callback);
 *
 * Building Two Related Queries:
 *
 * var nsql = norm().select("u.id").from("users u").where("u.id > ?", 5);
 * var nsql2 = nsql.clone().where("u.id < ?", 100);
 *
 * Author: William Silversmith
 * Date: March 2015
 */

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
							result.binds.reverse(); // since we're going to reverse them again...

							sql = sql.replace(/\?/, result.sql);
							
							sql_binds.push.apply(sql_binds, result.binds);
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

		return { sql: sql, binds: binds };
	};

	_this.sql = function () {
		return _this.sqlAndBinds().sql;
	};

	_this.binds = function () {
		return _this.sqlAndBinds().binds;
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


/*

Copyright (c) 2015, William Silversmith
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of norm nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/


