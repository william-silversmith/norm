var should = require('should');
var norm = require('../norm');

describe('Base Object', function () {
	it('Should return an object', function () {
	  	norm().should.be.an.instanceOf(Object);
	});
	it('Should return a trivially true statement', function () {
	  norm().sql().should.equal("select 1 from dual");
	});
	it('Should have a working toString method', function () {
	  (norm() + "").should.equal("select 1 from dual");
  	});
});

describe('Select', function () {
	it('Should allow adding one field', function () {
		norm()
			.select("foo")
			.sql().should.equal("select foo from dual");
	});
	
	it('Should allow adding multiple fields', function () {
		norm()
			.select("foo", "bar", "baz")
			.sql().should.equal("select foo, bar, baz from dual");
	});
	
	it('Should allow adding multiple fields using multiple select calls', function () {
		norm()
			.select("foo", "bar")
			.select("baz")
			.sql().should.equal("select foo, bar, baz from dual");
	});
	
	it('Should allow adding a field using a function reference', function () {
		norm()
			.select("foo", "bar", function () { return "baz" })
			.sql().should.equal("select foo, bar, baz from dual");
	});

	it('Should allow adding a field using another builder object', function () {
		var n1 = norm();
		norm()
			.select("foo", "bar", n1)
			.sql().should.equal("select foo, bar, (select 1 from dual) from dual");
	});

	it('Should allow adding a field using a bind and builder object', function () {
		var n1 = norm();
		norm()
			.select("foo", "bar", ["(?) tmp", n1])
			.sql().should.equal("select foo, bar, (select 1 from dual) tmp from dual");
	});

	it('Should remember binds', function () {
		var n1 = norm().select("foo", "bar", ["?", 'so happy']);
		n1.binds()[0].should.equal('so happy');
	});

	it('Binds operations should be idempotent', function () {
		var n1 = norm().select("foo", "bar", ["?", 'so happy']);
		n1.binds()[0].should.equal('so happy');
		n1.binds()[0].should.equal('so happy'); 
	});

	it('Binds appear in the correct order', function () {
		var n1 = norm().select("foo", ["?", "bar"], ["?", 'so happy']);
		n1.binds()[0].should.equal('bar');
		n1.binds()[1].should.equal('so happy'); 
	});
});

describe('From', function () {
	it('Should allow specification of a table', function () {
		norm().from("rawr").sql().should.equal("select 1 from rawr");
	});

	it('Should allow specification of multiple tables', function () {
		norm().from("rawr, omg").sql().should.equal("select 1 from rawr, omg");
	});

	it('Should allow specification of multiple tables w/ multiple statements', function () {
		norm()
			.from("rawr, omg")
			.from("wow")
			.sql().should.equal("select 1 from rawr, omg, wow");
	});

	it('Should not allow adding a field using another builder object', function () {
		(function () {
			norm().from("foo", "bar", norm())
		}).should.throw();
	});

	it('Should allow adding a field using a bind and builder object', function () {
		var n1 = norm();
		norm()
			.select("foo", "bar", ["(?) tmp", n1])
			.sql().should.equal("select foo, bar, (select 1 from dual) tmp from dual");
	});

	it('Binds operations should be idempotent', function () {
		var n1 = norm().from("foo", "bar", ["?", 'so happy']);
		n1.binds()[0].should.equal('so happy');
		n1.binds()[0].should.equal('so happy'); 
	});

	it('Binds appear in the correct order', function () {
		var n1 = norm().from("foo", ["?", "bar"], ["?", 'so happy']);
		n1.binds()[0].should.equal('bar');
		n1.binds()[1].should.equal('so happy'); 
	});
});

describe('Where', function () {
	it('Should allow specification of a single clause', function () {
		norm().where("a.id = b.id").sql().should.equal("select 1 from dual where a.id = b.id");
	});

	it('Should allow specification of multiple clauses', function () {
		norm().where("a.id = 0", "a.id = b.id")
			.sql().should.equal("select 1 from dual where a.id = 0 and a.id = b.id");
	});

	it('Should allow specification of multiple tables w/ multiple statements', function () {
		norm()
			.where("a.id = 0", "a.id = b.id")
			.where("exists (select 1 from dual)")
			.sql()
			.should.equal("select 1 from dual where a.id = 0 and a.id = b.id and exists (select 1 from dual)");
	});

	it('Accepts function arguments', function () {
		var n1 = norm();
		norm()
			.where("foo", "bar", function () { return "baz" })
			.sql().should.equal("select 1 from dual where foo and bar and baz");
	});

	it('Accepts builder binds', function () {
		var n1 = norm();
		var n2 = norm().where(
			["t.id < (?)", n1]
		);
		n2.sql().should.equal('select 1 from dual where t.id < (select 1 from dual)');
	});

	it('Binds appear in the correct order', function () {
		var n1 = norm().where(
			["t.id < ?", 5],
			["t.id > ?", 1]
		)
		.where(["b.time > ?", '2015-03-01']);

		n1.binds()[0].should.equal(5);
		n1.binds()[1].should.equal(1);
		n1.binds()[2].should.equal('2015-03-01');
	});

	it('Nested Binds Appear in the Correct Order', function () {
		var n1 = norm().where(
			["t.id < ?", 5],
			["t.id > ?", 1]
		)
		.where(["b.time > ?", '2015-03-01']);

		var n2 = norm().where(
			["a.omg = ?", 7],
			["a.zomg = ?", 8],
			["a.id < (?)", n1]
			["a.type = ?", 'lion'],
			["a.kingdom = ?", 'animalia']
		);

		n2.binds()[0].should.equal(7);
		n2.binds()[1].should.equal(8);
		n2.binds()[2].should.equal(5);
		n2.binds()[3].should.equal(1);
		n2.binds()[4].should.equal('2015-03-01');
		n2.binds()[5].should.equal('lion');
		n2.binds()[6].should.equal('animalia');
	});
});

describe('And', function () {
	it("Should generate and'ed statements", function () {
		norm()
			.and("a", "b", function () { return "c" }, "3 = 3")
			.call()
			.should.equal("(a and b and c and 3 = 3)")
	});

	it("Accepts another builder object as a bind", function () {
		norm()
			.and("a", "b", norm(), function () { return "c" }, "3 = 3")
			.call()
			.should.equal("(a and b and (select 1 from dual) and c and 3 = 3)")
	});
	
	it("Binds from the conjunction are included in the full query", function () {
		var n1 = norm();
		var result = n1.where(
			n1.and(
				"a.id = b.id",
				["a.time = ?", '2014-03-01']
			)
		).sqlAndBinds();
		
		result[0].should.equal("select 1 from dual where (a.id = b.id and a.time = ?)");
		result[1][0].should.equal("2014-03-01");
	});
});

describe('Or', function () {
	it("Should generate or'ed statements", function () {
		norm()
			.or("a", "b", function () { return "c" }, "3 = 3")
			.call()
			.should.equal("(a or b or c or 3 = 3)")
	});

	it("Accepts another builder object as a bind", function () {
		norm()
			.or("a", "b", norm(), function () { return "c" }, "3 = 3")
			.call()
			.should.equal("(a or b or (select 1 from dual) or c or 3 = 3)")
	});
	
	it("Binds from the conjunction are included in the full query", function () {
		var n1 = norm();
		var result = n1.where(
			n1.or(
				"a.id = b.id",
				["a.time = ?", '2014-03-01']
			),
			"a.wow = 'wow'"
		).sqlAndBinds();
		
		result[0].should.equal("select 1 from dual where (a.id = b.id or a.time = ?) and a.wow = 'wow'");
		result[1][0].should.equal("2014-03-01");
	});
});

describe('Group By', function () {
	it('Should generate an ordered query', function () {
		norm().groupby("time").sql().should.equal("select 1 from dual group by time");
	});

	it('Allows multiple parameters', function () {
		norm()
			.groupby("omg", "zomg")
			.sql()
			.should.equal("select 1 from dual group by omg, zomg");
	});

	it('Allows mutliple parameters via multiple calls', function () {
		norm()
			.groupby("omg")
			.groupby("zomg")
			.sql()
			.should.equal("select 1 from dual group by omg, zomg");
	});
});

describe('Order By', function () {
	it('Should generate an ordered query', function () {
		norm().orderby("omg asc").sql().should.equal("select 1 from dual order by omg asc");
	});

	it('Allows multiple parameters', function () {
		norm()
			.orderby("omg asc", "zomg desc")
			.sql()
			.should.equal("select 1 from dual order by omg asc, zomg desc");
	});

	it('Allows mutliple parameters via multiple calls', function () {
		norm()
			.orderby("omg asc")
			.orderby("zomg desc")
			.sql()
			.should.equal("select 1 from dual order by omg asc, zomg desc");
	});
});

describe('Limit', function () {
	it('Should generate a maximum bound on result set size', function () {
		norm().limit(5).sql().should.equal("select 1 from dual limit 5");
	});
	
	it('Should generate a maximum bound and offset on result set size', function () {
		norm().limit(5, 20).sql().should.equal("select 1 from dual limit 5, 20");
	});
});

describe('Distinct', function () {
	it('Should generate distinct queries', function () {
		norm().distinct().sql().should.equal("select distinct 1 from dual");
	});
	
	it('Should be cancelable', function () {
		norm().distinct().distinct(false).sql().should.equal("select 1 from dual");
	});
	
	it('Should be idempotent', function () {
		norm().distinct().distinct().sql().should.equal("select distinct 1 from dual");
	});
});

describe('Putting it All Together', function () {
	it('Users Query', function () {
		var sql = norm().select(
			"users.id",
			"users.name"
		)
		.from("users")
		.where(
			["users.id > ?", 1],
			"users.deleted is null"
		)
		.orderby("users.id desc")
		.limit(10)
		.distinct();

		sql.sql().should.equal("select distinct users.id, users.name from users where users.id > ? and users.deleted is null order by users.id desc limit 10");
	});

	it('Scoring Query', function () {
		var sql = norm().select(
			"scores.user_id",
			"IFNULL(sum(scores.points), 0) pts"
		)
		.from("scores")
		.where(
			["scores.created > ?", '2014-01-01']
		)
		.orderby("pts desc")
		.groupby("scores.user_id");

		sql.sql().should.equal("select scores.user_id, IFNULL(sum(scores.points), 0) pts from scores where scores.created > ? group by scores.user_id order by pts desc");
	});
});

describe('Cloning', function () {
	it('Clone Produces Valid SQL Output', function () {
		var n1 = norm().select("a.id").from("a").where("a.id = 5");
		var n2 = n1.clone();

		n2.sql().should.equal("select a.id from a where a.id = 5");
	});

	it('Identical Clones Produce Same SQL Output', function () {
		var n1 = norm().select("a.id").from("a").where("a.id = 5");
		var n2 = n1.clone();

		(n1.sql() === n2.sql()).should.be.ok;
	});

	it('Clones Can Produce Different SQL Output', function () {
		var n1 = norm().select("a.id").from("a").where("a.id = 5");
		var n2 = n1.clone().where("omg");

		(n1.sql() === n2.sql()).should.not.be.ok;
	});
});


