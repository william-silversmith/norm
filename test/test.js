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
			["t.id < ?", n1]
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
			["t.id < ?", 4],
			["t.id > ?", 5]
		)
		.where(["b.time > ?", 6]);

		var n2 = norm().where(
			["a.omg = ?", 1],
			["a.zomg = ?", 2],
			["a.id > ? and a.id < (?)", 3, n1],
			["a.type = ?", 7],
			["a.kingdom = ?", 8]
		);

		n2.binds()[0].should.equal(1);
		n2.binds()[1].should.equal(2);
		n2.binds()[2].should.equal(3);
		n2.binds()[3].should.equal(4);
		n2.binds()[4].should.equal(5);
		n2.binds()[5].should.equal(6);
		n2.binds()[6].should.equal(7);
		n2.binds()[7].should.equal(8);
	});

	it("Array Binds Work Correclty", function () {
		var n1 = norm().where(
			["a.id = ?", 1],
			["a.foo in (?)", [ 2, 3, 4, 5 ]],
			["a.txt = ?", 6]
		);

		n1.sql().should.equal("select 1 from dual where a.id = ? and a.foo in (?,?,?,?) and a.txt = ?");

		for (var i = 0; i < 6; i++) {
			n1.binds()[i].should.equal(i + 1);
		}
	});

	it('Should correctly convert binds to postgres style', function () {
		norm.engine('postgres');

		var n1 = norm()
			.select("wow")
			.from("wow")
			.where(
				["wow in (?, ?)", 1, 2 ],
				["zowie < ?", 3]
			);

		n1.sql().should.equal("select wow from wow where wow in ($1, $2) and zowie < $3");

		for (var i = 0; i < 3; i++) {
			n1.binds()[i].should.equal(i + 1);
		}

		norm.engine('mysql');
	});
});

describe('Having', function () {
	it('Should not allow specification of a single clause w/o group by', function () {
		norm().having("max(a.ct) = b.price").sql.should.throw();
	});

	it('Should allow specification of a single clause', function () {
		norm().groupby("a.id").having("max(a.ct) = b.price").sql().should.equal("select 1 from dual group by a.id having max(a.ct) = b.price");
	});

	it('Should allow specification of a multiple clauses', function () {
		norm()
			.groupby("a.id")
			.having("max(a.ct) = b.price")
			.having("sum(a.omg) > 9000")
			.sql().should.equal("select 1 from dual group by a.id having max(a.ct) = b.price and sum(a.omg) > 9000");
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
		var result = norm().where(
			norm.and(
				"a.id = b.id",
				["a.time = ?", '2014-03-01']
			)
		).sqlAndBinds();
		
		result.sql.should.equal("select 1 from dual where (a.id = b.id and a.time = ?)");
		result.binds[0].should.equal("2014-03-01");
	});
});

describe('Nand', function () {
	it("Should generate not and'ed statements", function () {
		norm
			.nand("a", "b", function () { return "c" }, "3 = 3")
			.call()
			.should.equal("not (a and b and c and 3 = 3)")
	});

	it("Should combine well with and", function () {
		norm.and(
			norm.nand("a", "b", function () { return "c" }, "3 = 3"),
			norm.nand("e", "f", "g")
		)
		.call()
		.should.equal("(not (a and b and c and 3 = 3) and not (e and f and g))")
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
		var result = norm().where(
			norm.or(
				"a.id = b.id",
				["a.time = ?", '2014-03-01']
			),
			"a.wow = 'wow'"
		).sqlAndBinds();
		
		result.sql.should.equal("select 1 from dual where (a.id = b.id or a.time = ?) and a.wow = 'wow'");
		result.binds[0].should.equal("2014-03-01");
	});
});

describe('Nor', function () {
	it("Should generate not or'ed statements", function () {
		norm
			.nor("a", "b", function () { return "c" }, "3 = 3")
			.call()
			.should.equal("not (a or b or c or 3 = 3)")
	});

	it("Should combine well with and", function () {
		norm.and(
			norm.nor("a", "b", function () { return "c" }, "3 = 3"),
			norm.nor("e", "f", "g")
		)
		.call()
		.should.equal("(not (a or b or c or 3 = 3) and not (e or f or g))")
	});
});

describe('Xor', function () {
	it("Should generate a valid xor statement", function () {
		norm
			.xor("a", "b")
			.call()
			.should.equal("(not (a and b) and (a or b))")
	});

	it("Two input xor statement is valid", function () {
		var xor = norm
			.xor("a", "b")
			.call();

		var code = xor.replace(/and/g, '&&').replace(/or/g, '||').replace(/not /g, "!");

		var correct = [ false, true, true, false ];
		for (var i = 0; i < 4; i++) {
			var a = i <= 1;
			var b = i % 2 === 0;

			eval(code).should.equal(correct[i]);
		}
	});

	it("Triple xor statement is one and only one (not nested xor)", function () {
		var xor = norm
			.xor("a", "b", "c")
			.call();

		var code = xor.replace(/and/g, '&&').replace(/or/g, '||').replace(/not /g, "!");

		var correct = [ false, false, false, true, false, true, true, false ];
		for (var i = 0; i < 8; i++) {
			var a = i <= 3;
			var b = Math.floor(i / 2) % 2 === 0;
			var c = i % 2 === 0;

			eval(code).should.equal(correct[i]);
		}
	});

	it("Throws error for bad input.", function () {
		(function () {
			norm.xor("a")
		}).should.throw();
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

describe('Array Variants Equal Originals', function () {
	it('#selecta', function () {
		var n1 = norm().select('omg', 'wow');
		var n2 = norm().selecta(['omg', 'wow']);

		n1.sql().should.equal(n2.sql());
	});

	it('#froma', function () {
		var n1 = norm().from('omg', 'wow');
		var n2 = norm().froma(['omg', 'wow']);

		n1.sql().should.equal(n2.sql());
	});

	it('#wherea', function () {
		var n1 = norm().where('omg', 'wow');
		var n2 = norm().wherea(['omg', 'wow']);

		n1.sql().should.equal(n2.sql());
	});

	it('#groupbya', function () {
		var n1 = norm().groupby('omg', 'wow');
		var n2 = norm().groupbya(['omg', 'wow']);

		n1.sql().should.equal(n2.sql());
	});

	it('#orderbya', function () {
		var n1 = norm().orderby('omg', 'wow');
		var n2 = norm().orderbya(['omg', 'wow']);

		n1.sql().should.equal(n2.sql());
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

describe('Update', function () {
	it("Should throw error for invalid update queries", function () {
		norm().update("a").sql.should.throw();
		norm().set("a = 1").sql.should.throw();
	});

	it("Should generate valid update queries", function () {
		norm().update("a").set("a.x = 1")
			.sql().should.equal("update a set a.x = 1");
	});

	it("Should generate valid update queries with where clauses", function () {
		norm().update("a").set("a.x = 1")
			.where("a.y > 5", "a.z > 4")
			.sql().should.equal("update a set a.x = 1 where a.y > 5 and a.z > 4");
	});

	it("Should handle order by", function () {
		norm().update("a").set("a.x = 1")
			.where("a.y > 5", "a.z > 4")
			.orderby("a.y asc", "a.z desc")
			.sql().should.equal("update a set a.x = 1 where a.y > 5 and a.z > 4 order by a.y asc, a.z desc");
	});

	it("Should handle limit", function () {
		norm().update("a").set("a.x = 1")
			.where("a.y > 5", "a.z > 4")
			.orderby("a.y asc", "a.z desc")
			.limit(5)
			.sql().should.equal("update a set a.x = 1 where a.y > 5 and a.z > 4 order by a.y asc, a.z desc limit 5");
	});

	it("Should handle select subquery", function () {
		var query = norm().select("sum(foo.x)").from("foo");

		norm().update("a")
			.set(["a.x = ?", query])
			.sql().should.equal("update a set a.x = (select sum(foo.x) from foo)");
	});
});


describe('Delete', function () {
	it("Should generate a valid delete query", function () {
		norm().delete("foo").sql().should.equal("delete from foo");
	});

	it("Should generate valid delete queries with where clauses", function () {
		norm().delete("a")
			.where("a.y > 5", "a.z > 4")
			.sql().should.equal("delete from a where a.y > 5 and a.z > 4");
	});

	it("Should handle using", function () {
		norm().delete("films")
			.where(
				"producer_id = producers.id", 
				["producers.name = ?", 'foo']
			)
			.using("producers")
			.sql().should.equal("delete from films using producers where producer_id = producers.id and producers.name = ?");
	});


	it("Should handle order by", function () {
		norm().delete("a")
			.where("a.y > 5", "a.z > 4")
			.orderby("a.y asc", "a.z desc")
			.sql().should.equal("delete from a where a.y > 5 and a.z > 4 order by a.y asc, a.z desc");
	});

	it("Should handle limit", function () {
		norm().delete("a")
			.where("a.y > 5", "a.z > 4")
			.orderby("a.y asc", "a.z desc")
			.limit(5)
			.sql().should.equal("delete from a where a.y > 5 and a.z > 4 order by a.y asc, a.z desc limit 5");
	});
});

describe("Insert", function () {
	it("Should generate valid insert queries from array input", function () {
		var n1 = norm().insert("foo (a,b)").values([1,2], [3,4], [5,6]);
		n1.sql().should.equal("insert into foo (a,b) values (?,?),(?,?),(?,?)");

		for (var i = 0; i < 6; i++) {
		 	n1.binds()[i].should.equal(i + 1);
		}
	});

	it("Should generate valid insert queries from hash input", function () {
		var n1 = norm().insert("foo").values({ a: 1, b: 2}, { a: 3, b: 4 }, { a: 5, b: 6 });
		n1.sql().should.equal("insert into foo (a,b) values (?,?),(?,?),(?,?)");

		for (var i = 0; i < 6; i++) {
		 	n1.binds()[i].should.equal(i + 1);
		}
	});

	it("Should generate valid insert select queries", function () {
		var n1 = norm()
			.insert("foo (id,val)")
			.select("bar.id, bar.val")
			.from("bar")
			.where(["bar.sass = ?", 'extreme']);

		n1.sql().should.equal("insert into foo (id,val) select bar.id, bar.val from bar where bar.sass = ?");
		n1.binds()[0].should.equal('extreme');
	});

	it("Simplified syntax for single column inserts works", function () {
		var n1 = norm()
			.insert("shangrila (col)")
			.values(1,2,3,4,5);


		n1.sql()
			.should.equal("insert into shangrila (col) values (?),(?),(?),(?),(?)");

		var bnds = n1.binds();
		for (var i = 0; i < bnds.length; i++) {
			bnds[i].should.equal(i+1);
		}
	});

	it("Should allow multiple applications of values", function () {
		var n1 = norm()
			.insert("shangrila (col)")
			.values(1,2,3);
		
		n1.values(4,5,6);

		n1.sql().should.equal("insert into shangrila (col) values (?),(?),(?),(?),(?),(?)");

		var bnds = n1.binds();
		for (var i = 0; i < bnds.length; i++) {
			bnds[i].should.equal(i+1);
		}
	});

	it("Should allow object values (precursor for raws)", function () {
		var n1 = norm()
			.insert("shangrila")
			.values({
				a: 1,
				b: {
					value: 0,
				},
			});

		n1.sql().should.equal("insert into shangrila (a,b) values (?,?)");

		var bnds = n1.binds();
		bnds[0].should.equal(1);
		bnds[1].should.equal(0);
	});

	it("Should allow raw values", function () {
		var n1 = norm()
			.insert("shangrila")
			.values({
				a: 1,
				b: {
					value: "NOW()",
					raw: true,
				},
			});

		n1.sql().should.equal("insert into shangrila (a,b) values (?,NOW())");

		var bnds = n1.binds();
		for (var i = 0; i < bnds.length; i++) {
			bnds[i].should.equal(i+1);
		}
	});
});
