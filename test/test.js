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
		n1.binds()[0].should.equal('so happy');
	});
});








