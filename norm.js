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

 var _db_type = 'mysql';

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

						sql = sql.replace(/\(\?\)|\?/, "(" + result.sql + ")");
						
						sql_binds.push.apply(sql_binds, result.binds);
					}
					else { 
						if (!Array.isArray(bnd)) {
							bnd = [bnd];
						}

						// using '¿' to mark already processed '?'
						var bndstring = bnd.map(function () { return '¿' }).join(",");
						sql = sql.replace(/\?/, bndstring);

						var bndcpy = bnd.slice(0);
						bndcpy.reverse();

						sql_binds.push.apply(sql_binds, bndcpy);
					}
				});

				sql = sql.replace(/¿/g, '?');

				return fn(sql_binds) + " " + sql + conjunction;

			}).bind(null, fn);
		}
		else if (typeof(stmt) === 'function') {
			fn = (function (fn, binds) {
				return fn(binds) + " " + stmt(binds) + conjunction;
			}).bind(null, fn);
		}
		else if (stmt.sql) {
			fn = (function (fn, binds) {
				return fn(binds) + " (" + stmt.sql() + ")" + conjunction;
			}).bind(null, fn);
		}
		else { // e.g. str, bool, num, object (w/ toString)
			fn = (function (fn, binds) {
				return fn(binds) + " " + stmt + conjunction;
			}).bind(null, fn);
		}
	});

	return fn;
}

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
			having: null,
			limit: null,
			distinct: false,

			update: null,
			set: null,

			"delete": null,
			using: null,

			insert: null,
			values: null,

			db_engine: _db_type,
		};
	}

	function ur_clause (base, conjunction) {
		return function () {
			var args = Array.prototype.slice.call(arguments);
			var basefn = base.replace(' ', '');
			var fn = _partials[basefn] || function () { return base };

			if (!args.length) {
				return _this;
			}

			_partials[basefn] = processArguments(fn, args, conjunction);

			return _this;
		};
	}

	_this.select = ur_clause('select', ',');

	_this.from = function () {
		var args = Array.prototype.slice.call(arguments);

		args.forEach(function (arg) {
			if (arg.sql) {
				throw new Error("You need to name your subquery: " + arg.sql());
			}
		});

		return ur_clause('from', ',').apply(null, args);
	};

	_this.where = ur_clause("where", " and");
	_this.groupby = ur_clause("group by", ",");
	_this.having = ur_clause("having", " and");
	_this.orderby = ur_clause("order by", ",");

	_this.update = ur_clause("update", ",");
	_this.set = ur_clause("set", ",");

	_this.delete = function () {
		var args = Array.prototype.slice.call(arguments);
		var fn = _partials['delete'] || function () { return "delete from" };

		if (!args.length) {
			return _this;
		}

		_partials['delete'] = processArguments(fn, args, ",");

		return _this;
	};

	_this.using = ur_clause("using", ",");

	_this.insert = function (table) {
		if (!table) {
			return _this;
		}

		_partials.insert = function () {
			return "insert into " + table;
		};

		return _this;
	};

	function paren (x) { return "(" + x + ")" }

	_this.values = function () {
		var args = Array.prototype.slice.call(arguments);
		_partials.values = _partials.values || function () { return "values " };

		if (!args.length) {
			return _this;
		}

		var cols;
		var values = args;

		if (!Array.isArray(args[0]) && typeof(args[0]) === 'object') {
			cols = Object.keys(args[0]);
			cols.sort();

			values = args.map(function (vals) {
				var elem = [];
				for (var i = 0; i < cols.length; i++) {
					elem.push(vals[cols[i]]);
				}

				return elem;
			});

			cols = paren(cols.join(","));
		}
		else if (!Array.isArray(args[0])) {
			values = args.map(function (x) { return [x] });
		}
		
		_partials.values = (function (fn, binds) {
			var dml = fn(binds); // do this first to ensure binds are added in the correct order

			var qmarks = values.map(function (vals) {
				vals.reverse();
				var vals_without_raws = vals.filter(function (x) {
					return typeof(x) !== 'object' || !x.raw;
				})
				.map(function (x) {
					return x.value === undefined 
						? x 
						: x.value;
				});
				
				binds.unshift.apply(binds, vals_without_raws);
				vals.reverse();

				return paren(vals.map(function (x) { 
					if (typeof(x) !== 'object' || !x.raw) {
						return '?';
					}

					return x.value;
				}).join(","));
			}).join(",");

			dml = dml + qmarks + ',';

			if (cols) {
				dml = dml.replace(/^(\(.*\))? ?values/, cols + " values");
			}

			return dml;
		}).bind(null, _partials.values);

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

	function striplast (conjunction, fn) {
		var regex = new RegExp(conjunction + "\\s*$");
		return function (binds) {
			return fn(binds).replace(regex, ''); // remove last comma
		};
	}

	function selectQuery () {
		var fns = [
		 	striplast(",", _partials.select || function () { return "select 1" }),
		 	striplast(",", _partials.from || function () { return "from dual" }),
		 	striplast(" and", _partials.where || function () { return "" }),
		 	striplast(",", _partials.groupby || function () { return "" }),
		 	striplast(" and", _partials.having || function () { return "" }),
		 	striplast(",", _partials.orderby || function () { return "" }),
		 	_partials.limit || function () { return  "" }
		];

		if (_partials.distinct) {
			 fns[0] = (function (fn, binds) {
			 	return fn(binds).replace(/^\s*select(\s*distinct)?/, "select distinct");
			 }).bind(_this, fns[0]);
		}

		return fns;
	}

	function updateQuery () {
		var fns = [
			striplast(",", _partials.update),
			striplast(",", _partials.set),
			striplast(" and", _partials.where || function () { return "" }),
			striplast(",", _partials.orderby || function () { return "" }),
			_partials.limit || function () { return  "" }
		];

		if (!_partials.update || !_partials.set) {
			throw new Error("You must specify update and set clauses.");
		}

		return fns;
	}

	function deleteQuery () {
		var fns = [
			striplast(",", _partials['delete']),
			striplast(",", _partials.using || function () { return "" }),
			striplast(" and", _partials.where || function () { return "" }),
		 	striplast(",", _partials.orderby || function () { return "" }),
		 	_partials.limit || function () { return  "" }
		];

		if (!_partials['delete']) {
			throw new Error("You must specify a delete clause.");
		}

		return fns;
	}

	function insertQuery () {
		if (!_partials.values && !_partials.select) {
			throw new Error("You must specify a values or select clause.");
		}

		if (_partials.values) {
			return [
				_partials.insert,
				striplast(",", _partials.values)
			];
		}

		// for insert into ... select

		var fns = [ _partials.insert ];
		fns.push.apply(fns, selectQuery());
		return fns;
	}

	_this.sqlAndBinds = function () {
		var fns;

		if (_partials.update || _partials.set) {
			fns = updateQuery();
		}
		else if (_partials.delete) {
			fns = deleteQuery();
		}
		else if (_partials.insert) {
			fns = insertQuery();
		}
		else {
			fns = selectQuery();
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

		if (_partials.having && !_partials.groupby) {
			throw new Error("You must have a group by clause to use a having clause: " + sql);
		}

		// binds are added in reverse order b/c functions are evaluated outside-in
		binds.reverse();

		if (_partials.db_engine === 'postgres') {
			sql = convertToPostgres(sql, binds);
		}

		return { sql: sql, binds: binds };
	};

	function convertToPostgres (sql, binds) {
		sql = sql || "";

		for (var i = 1; i <= binds.length; i++) {
			sql = sql.replace(/\?/, "$" + i);
		}

		return sql;
	}

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
	_this.and = norm.and;
	_this.nand = norm.nand;
	_this.or = norm.or;
	_this.nor = norm.nor;

	// Generate array parameter versions of select, from, etc
	// as 'selecta', 'froma', etc
	[ 'select', 'from', 'where', 'groupby', 'orderby', 'values' ].forEach(function (funcname) {
		_this[funcname + 'a'] = function (array) {
			return _this[funcname].apply(_this, array);
		};
	});

	return _this;
}

norm.engine = function (type) {
	if (type === undefined) {
		return _db_type;
	}

	_db_type = type || 'mysql';

	return _db_type;
};

norm.and = function () {
	var args = Array.prototype.slice.call(arguments);
	var fn = function () { return "" };

	fn = processArguments(fn, args, " and");

	return function (binds) {
		var expr = fn(binds).replace(/and\s*$/, '');
		return "(" + expr.trim() + ")";
	};
};

norm.nand = function () {
	var args = Array.prototype.slice.call(arguments);

	return function (binds) {
		return "not " + norm.and.apply(null, args).call();
	};
};

norm.or = function () {
	var args = Array.prototype.slice.call(arguments);
	var fn = function () { return "" };
	
	fn = processArguments(fn, args, " or");

	return function (binds) {
		var expr = fn(binds).replace(/or\s*$/, '');
		return "(" + expr.trim() + ")";
	};
};

norm.nor = function () {
	var args = Array.prototype.slice.call(arguments);

	return function (binds) {
		return "not " + norm.or.apply(null, args).call();
	};
};

norm.xor = function () {
	var args = Array.prototype.slice.call(arguments);

	if (args.length <= 1) {
		throw new Error("Cannot xor fewer than two arguments.");
	}

	if (args.length === 2) {
		// implemented this way for maximum compatibility
		// some sql implementations support an 'xor' keyword
		// feel free to adapt this code if necessary
		return norm.and(
			norm.nand.apply(null, args),
			norm.or.apply(null, args)
		);
	}


	// Two choices here: Does multi-xor mean
	// nested two pin xors (odd parity) or does
	// it mean one and only one? 

	// I'm taking a guess here and thinking that
	// the more useful operation is one and only one

	var ors = [];
	for (var i = 0; i < args.length; i++) {
		var others = args.slice();
		others.splice(i, 1);

		ors.push(
			norm.and(
				args[i],
				norm.nor.apply(null, others)
			)
		);
	};

	return norm.or.apply(null, ors);
};

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


